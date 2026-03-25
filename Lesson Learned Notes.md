# Lesson Learned Notes
## Pandapower — CGG Fork Modding & Experimentation

**Repository:** `Comfac-Global-Group/pandapower`
**Fork policy:** Compartmentalized — no upstream merge intended
**Started:** 2026-03-25

---

## Purpose of This Document

This is a running log of discoveries, gotchas, patterns, and hard-won knowledge from working with pandapower in the CGG fork. Every time something surprising, non-obvious, or time-consuming is resolved, it goes here so the next person (or next session) doesn't repeat the work.

Structure: most recent entries at the top within each section.

---

## Table of Contents

1. [Installation & Environment](#1-installation--environment)
2. [Power Flow — Convergence Issues](#2-power-flow--convergence-issues)
3. [Network Construction Gotchas](#3-network-construction-gotchas)
4. [Time-Series Simulation Patterns](#4-time-series-simulation-patterns)
5. [Pyodide / Browser Execution](#5-pyodide--browser-execution)
6. [Result Interpretation](#6-result-interpretation)
7. [Standard Types Library](#7-standard-types-library)
8. [File I/O Patterns](#8-file-io-patterns)
9. [Controller Framework](#9-controller-framework)
10. [Performance & Optimization](#10-performance--optimization)
11. [Testing & Debugging Workflows](#11-testing--debugging-workflows)
12. [Fork-Specific Decisions](#12-fork-specific-decisions)
13. [Open Questions / TODO](#13-open-questions--todo)
14. [GitHub Pages Deployment — Challenges & Reality Check](#14-github-pages-deployment--challenges--reality-check)

---

## 1. Installation & Environment

### CGG fork install (editable mode)
```bash
cd /home/justin/opencode260220/pandapower
pip install -e ".[plotting,fileio]"
```
The `[plotting,fileio]` extras pull in `matplotlib`, `plotly`, `xlsxwriter`, `openpyxl`.

For performance extras (not always needed):
```bash
pip install -e ".[performance]"   # adds numba, lightsim2grid
```

### Python version requirement
Pandapower requires **Python ≥ 3.10**. This matters in environments where Python 3.9 is default.

```bash
python --version   # must be 3.10+
```

### Dependency pinning caution
The `pyproject.toml` pins tightly (e.g., `pandas ~2.3`). In shared environments, installing pandapower may downgrade or conflict with other packages. Use a dedicated virtual environment.

```bash
python -m venv venv-pandapower
source venv-pandapower/bin/activate
pip install -e ".[plotting,fileio]"
```

### Verify install
```python
import pandapower as pp
print(pp.__version__)
net = pp.networks.example_simple()
pp.runpp(net)
print("OK:", net.converged)
```

---

## 2. Power Flow — Convergence Issues

### Most common reason for non-convergence: isolated buses

If any bus in the network is electrically disconnected (no line or switch connecting it to the rest), `runpp()` will fail. Always run:
```python
pp.diagnostic(net, report_style='detailed')
```
before debugging a convergence failure.

### Flat start vs. DC initialization

- **`init='flat'`** — all voltages start at 1.0 pu, all angles at 0°. Fast but can fail on ill-conditioned networks.
- **`init='dc'`** — runs a DC power flow first to get initial angle estimates. Much better for meshed networks and high-loading cases.
- **`init='auto'`** — uses 'dc' if the DC solution succeeds, else falls back to 'flat'. This is the default and usually correct.

When debugging convergence: **explicitly try `init='dc'`** before giving up.

### Newton-Raphson iteration limit

Default `max_iteration=10` is often too low for distribution networks with high R/X ratios. For LV networks (400V), use:
```python
pp.runpp(net, max_iteration=50, tolerance_mva=1e-6)
```

Tight tolerance (`1e-8`) + more iterations = more reliable convergence.

### Iwamoto multiplier

For severely ill-conditioned cases (very high loading, near-voltage-collapse), pandapower has an Iwamoto step-size multiplier built into the NR algorithm. It's activated automatically when standard NR fails to converge. No special flag needed — just increase `max_iteration`.

### Transformer tap position extremes

Setting `net.trafo.tap_pos` to extreme values (e.g., +10 or -10 beyond the tap range) will cause convergence failure or garbage results. Keep tap positions within the rated range specified in the standard type.

### Load in MVA vs. per-unit

All loads are in **MW and MVAr** (not per-unit, not kW). A common mistake when working with small LV networks:
- A residential house: ~0.005 MW (5 kW) — **not** 5 MW
- A small commercial building: ~0.05–0.2 MW
- An industrial feeder: 1–10 MW

Using MW values that are too large relative to the network capacity (e.g., 100 MW load on a 0.4 kV network) will prevent convergence.

### Consumer convention for power signs

Pandapower uses **consumer convention**:
- **Positive P/Q** = consumption (loads)
- **Negative P/Q** = injection/generation

This is the opposite of the IEEE generator convention used in some textbooks. When reading `net.res_bus.p_mw`, a negative value at a generator bus means the generator is producing power (which is correct).

---

## 3. Network Construction Gotchas

### Bus voltage levels must match at line endpoints

Lines connect buses with the **same nominal voltage**. If you try to connect a 11 kV bus to a 0.4 kV bus with a line, pandapower will either silently accept it (wrong model) or error. Use a **transformer** for voltage level changes.

```python
# WRONG
pp.create_line(net, hv_bus_11kv, lv_bus_400v, ...)

# CORRECT
pp.create_trafo(net, hv_bus=hv_bus_11kv, lv_bus=lv_bus_400v,
                std_type="0.25 MVA 11/0.4 kV")
```

### Exactly one external grid required

`runpp()` requires **exactly one slack bus** (external grid). If there are zero:
- Error: "No slack bus defined"

If there are more than one external grid:
- The system is over-determined — each ext_grid will fight over voltage
- This can cause convergence issues

For multiple grid connections, use `gen` with `slack=True` for additional slacks, or use the `distributed_slack=True` parameter.

### `create_line` uses `std_type` OR manual parameters — not both

If you specify `std_type`, do NOT also specify `r_ohm_per_km`, `x_ohm_per_km`, etc. They will conflict.

```python
# CORRECT: use std_type
pp.create_line(net, b1, b2, length_km=1.0, std_type="NAYY 4x150 SE")

# CORRECT: use manual parameters
pp.create_line_from_parameters(net, b1, b2, length_km=1.0,
    r_ohm_per_km=0.206, x_ohm_per_km=0.08,
    c_nf_per_km=261, max_i_ka=0.27)
```

### `net.res_*` tables are overwritten on each `runpp()` call

Don't try to accumulate results across multiple runs by reading from `net.res_bus`. Use the OutputWriter for time-series or manually copy results between runs:

```python
pp.runpp(net)
results_step_1 = net.res_bus.copy()   # explicit copy
net.load.at[0, 'p_mw'] = 2.0
pp.runpp(net)
results_step_2 = net.res_bus.copy()
```

### DataFrame index vs. element index

Pandapower element indices are the **DataFrame index**, not the row number. After adding and removing elements, the index may not be contiguous:

```python
pp.create_load(net, b2, p_mw=1.0)  # returns, say, index 0
pp.create_load(net, b3, p_mw=0.5)  # returns index 1
net.load.drop(0, inplace=True)      # remove first load
# net.load index is now [1], not [0]

# Access by index label, not position:
net.load.at[1, 'p_mw'] = 0.8     # correct
net.load.iloc[0]['p_mw']          # also works but confusing
```

### Geodata is optional but required for geographic plotting

`net.bus_geodata` is an empty DataFrame by default. Without it, geographic plots fail. Set it manually:

```python
net.bus_geodata.loc[0] = [1.0, 0.0]   # (x, y) in coordinate units
net.bus_geodata.loc[1] = [1.5, 0.0]
```

---

## 4. Time-Series Simulation Patterns

### `DFData` requires DataFrame with correct index

The `DFData` wrapper expects a pandas DataFrame where the **row index matches the time step numbers** passed to `run_timeseries`.

```python
# CORRECT: index matches time_steps=range(96)
profiles = pd.DataFrame({"load_p": values}, index=range(96))

# WRONG: default integer index starting at 0 also works, but be explicit
```

### `ConstControl` profile_name must match DataFrame column name exactly

Case-sensitive. `profile_name='Load_P'` will not find `'load_p'`.

### OutputWriter must be created BEFORE run_timeseries

```python
ow = ts.OutputWriter(net, ...)
ow.log_variable('res_bus', 'vm_pu')   # register what to log
ts.run_timeseries(net, ...)            # run — ow captures each step
print(ow.output['res_bus.vm_pu'])      # access results
```

If you forget to set up the OutputWriter, no results are captured. The function runs but discards intermediate results.

### OutputWriter output key format

The key in `ow.output` is `'table_name.column_name'`:
- `ow.output['res_bus.vm_pu']` — bus voltages
- `ow.output['res_line.loading_percent']` — line loadings
- `ow.output['res_line.pl_mw']` — line active losses

### `continue_on_divergence=True` hides problems

Using `continue_on_divergence=True` means the simulation will skip non-converged time steps. The output will have **NaN values** at those steps. Always check:

```python
voltages = ow.output['res_bus.vm_pu']
n_nan = voltages.isnull().any(axis=1).sum()
print(f"Non-converged steps: {n_nan} of {len(voltages)}")
```

### Memory usage with large time-series

For 8760-step annual simulations (hourly) on large networks (100+ buses), the OutputWriter can accumulate significant memory. Options:
1. Log fewer variables
2. Write output to disk (set `output_path` in OutputWriter)
3. Batch the simulation in chunks of 24 or 168 time steps

---

## 5. Pyodide / Browser Execution

### Pyodide can install pandapower via micropip — with caveats

```python
import micropip
await micropip.install('pandapower')
```

This works but installs the **PyPI version**, not the CGG fork. For the web UI, this is acceptable since the web UI uses pandapower as a computation library, not as a forked feature.

### Pyodide first-load time

Pyodide + pandapower first load: **20–40 seconds** on a standard connection. After the first visit, packages are cached in the browser.

**Mitigations:**
- Show a loading progress bar
- Disable the Run button until Pyodide is ready
- Consider preloading Pyodide in a Service Worker

### Pandas in Pyodide

Pandas is included in the Pyodide standard distribution. `numpy` and `scipy` also available. No extra install needed for these.

### Return data from Python to JavaScript

Pyodide's `runPythonAsync()` returns the last expression value. Return JSON:

```python
# In Python (executed via Pyodide)
import json
result = {"converged": True, "vm_pu": [1.02, 0.985, 0.978]}
json.dumps(result)   # this is the return value
```

```javascript
// In JavaScript
const jsonStr = await pyodide.runPythonAsync(pythonCode);
const result = JSON.parse(jsonStr);
```

### pandas DataFrames cannot be directly passed to JS

Convert to dict/list first:
```python
net.res_bus.to_dict(orient='records')   # list of row dicts
```

### Error handling in Pyodide

Wrap Python execution in try/except and return error info in JSON:
```python
try:
    pp.runpp(net)
    return json.dumps({"converged": True, ...})
except Exception as e:
    return json.dumps({"converged": False, "error": str(e)})
```

Check `result.converged` in JavaScript before rendering results.

---

## 6. Result Interpretation

### Voltage per-unit (pu) — what the numbers mean

| vm_pu | What it means |
|---|---|
| 1.00 | Exactly nominal voltage |
| 1.02 | 2% above nominal (typical grid supply) |
| 0.95 | 5% below nominal — lower voltage limit |
| 0.90 | 10% below nominal — serious under-voltage |
| 1.05 | 5% above nominal — upper voltage limit |
| 1.10 | 10% above nominal — serious over-voltage (often caused by excess solar) |

### Line loading percent

`loading_percent = (actual_current / max_current) × 100`

- **< 70%:** Normal operation
- **70–90%:** Elevated — consider monitoring
- **90–100%:** Warning — thermal limit approaching
- **> 100%:** Overload — cable is exceeding rated capacity

### Power sign convention (consumer)

In `net.res_bus`:
- `p_mw > 0` at a load bus: consuming power (expected)
- `p_mw < 0` at a generator bus: injecting power (expected)
- `p_mw < 0` at a load bus: this bus is a net exporter (possible with solar)

In `net.res_line`:
- `p_from_mw` is power entering the line at the from-bus
- `p_to_mw` is power arriving at the to-bus
- `pl_mw = p_from_mw - p_to_mw` (positive = active losses in line)

### Reactive power and power factor

`q_mvar` in loads represents reactive power demand. A load with:
- `p_mw=1.0, q_mvar=0.5` → power factor = cos(arctan(0.5/1.0)) ≈ 0.894

Typical power factors:
- Residential: 0.85–0.95
- Industrial: 0.7–0.9 (motors are inductive)
- Commercial: 0.9–0.95

High reactive power (low power factor) increases line current and losses without delivering useful work.

---

## 7. Standard Types Library

### Listing all available standard types

```python
net = pp.create_empty_network()

# All line types
print(list(net.std_types['line'].keys()))

# All transformer types
print(list(net.std_types['trafo'].keys()))
```

### Adding a custom standard type

```python
pp.create_std_type(net, {
    "r_ohm_per_km": 0.162,
    "x_ohm_per_km": 0.083,
    "c_nf_per_km": 210,
    "max_i_ka": 0.385,
    "type": "cs"    # 'cs' = cable, 'ol' = overhead line
}, name="MY_CABLE_185", element="line")
```

Custom types are stored in `net.std_types['line']` and are lost when the network is discarded unless saved with `pp.to_json()`.

### `std_types` are NOT saved in `to_pickle()` by default

Use `pp.to_json()` to ensure custom standard types are preserved. The JSON format explicitly serializes `std_types`.

---

## 8. File I/O Patterns

### JSON is the recommended format for CGG work

```python
pp.to_json(net, "network_study.json")
net = pp.from_json("network_study.json")
```

Reasons:
- Human readable — can inspect in any text editor
- Version-safe — `convert=True` parameter handles older format upgrades
- Includes `std_types`, `controller`, and all metadata
- Works well with git (diffs are readable)

### Pickle is faster but fragile

```python
pp.to_pickle(net, "network.pkl")
net = pp.from_pickle("network.pkl")
```

Pickle format breaks between Python minor versions and pandapower versions. **Do not use pickle for long-term storage or file sharing.**

### Excel for non-Python sharing

```python
pp.to_excel(net, "network.xlsx")
net = pp.from_excel("network.xlsx")
```

Useful for handing off network data to engineers who need to edit parameters manually. However, complex elements (controllers) are not well-supported.

---

## 9. Controller Framework

### Controller execution order matters

Multiple controllers on the same element execute in the order they were added. If Controller B depends on the result of Controller A, ensure A is added first.

### `ConstControl` is for driving parameters from profiles

It does NOT do feedback control. It simply overwrites a parameter at each time step. For real control logic (e.g., tap changer responding to voltage), use `ContinuousTapControl` or `DiscreteTapControl`.

### Controller diagnostics

If a controller is misbehaving, check its state:
```python
for controller in net.controller.object.values:
    print(type(controller).__name__, controller.applied)
```

### `run_control=False` in runpp

By default, `runpp()` runs all controllers before solving. To disable:
```python
pp.runpp(net, run_control=False)
```

This is useful when manually stepping through time-series logic outside of `run_timeseries()`.

---

## 10. Performance & Optimization

### Numba JIT acceleration

The `numba` package accelerates the Newton-Raphson matrix assembly. Install once:
```bash
pip install numba
```

Then:
```python
pp.runpp(net, numba=True)   # first call: slow (JIT compile), subsequent calls: fast
```

**Do not use numba in Pyodide** — Numba is not available in the browser environment.

### lightsim2grid for large networks

For networks with 500+ buses running thousands of power flows:
```bash
pip install lightsim2grid
```
```python
pp.runpp(net, lightsim2grid=True)   # ~10-50x faster than pure Python NR
```

### Result recycling in repeated runs

If only load values change between runs (same topology):
```python
pp.runpp(net, recycle={'bus_pq': True, 'trafo': False, 'gen': False})
```

Recycling reuses expensive matrix calculations from the previous run.

### Disabling connectivity check for speed

In known-good networks running time-series:
```python
pp.runpp(net, check_connectivity=False)
```

Saves ~5ms per run. On 96-step time-series = ~0.5s saved.

---

## 11. Testing & Debugging Workflows

### Always validate with a known-good network first

When debugging a custom network, first run `pp.networks.example_simple()` to confirm the environment is working. If example_simple fails, the problem is the install, not the network.

### `pp.diagnostic()` as first debug step

```python
pp.diagnostic(net, report_style='detailed')
```

Returns a dict of findings. Common issues caught:
- `"isolated_buses"` — buses not connected to the network
- `"disconnected_elements"` — elements connected to out-of-service buses
- `"multiple_voltage_controlling_elements_per_bus"` — two generators fighting for voltage
- `"nominal_voltages_dont_match"` — line connecting buses at different voltage levels

### Plotting for topology debugging

```python
import pandapower.plotting as ppplot
ppplot.simple_plot(net, plot_line_switches=True)
```

Visually inspect the network topology — often faster than reading DataFrames.

### Step-through debugging with manual runpp calls

For time-series issues, manually replay the worst time step:

```python
# After a failed time-series run, replay step 42
net.load.at[load_id, 'p_mw'] = profiles.loc[42, 'load_p']
net.sgen.at[sgen_id, 'p_mw'] = profiles.loc[42, 'solar_p']
pp.runpp(net, verbose=True)   # verbose shows iteration details
```

### Checking network data before running

```python
# Quick sanity checks
print("Buses:", len(net.bus))
print("Lines:", len(net.line))
print("Loads:", len(net.load))
print("Ext grids:", len(net.ext_grid))
print("In service loads:", net.load.in_service.sum())
print("Total load:", net.load.p_mw.sum(), "MW")
```

---

## 12. Fork-Specific Decisions

### Decision 1: No upstream PRs

The CGG fork modifies pandapower for internal use. Changes are not contributed back upstream. Reason: CGG's modifications may include proprietary network data, client-specific parameters, or experimental features not suitable for the upstream project.

**Consequence:** We must manually track and apply any important upstream bugfixes.

### Decision 2: Compartmentalized web UI

The GitHub Pages Power Flow web UI lives in `docs/pf-web/` in this repo. It:
- Uses pandapower from PyPI (via Pyodide/micropip) — not the CGG fork
- Has no dependency on CGG's internal systems
- Can be shared externally without exposing internal network data

**Why:** The web UI is an educational/demo tool. It benefits from the stable upstream pandapower rather than our experimental fork.

### Decision 3: JSON as canonical format

All network files shared within CGG use JSON (`.json`). Excel is used only for input/output exchange with non-Python engineers. Pickle is not used.

### Decision 4: Coordinate system for geodata

When adding geographic plotting to networks, use **decimal degrees (WGS84)** for coordinates. Store in `net.bus_geodata` as `(x=longitude, y=latitude)`.

### Decision 5: 15-minute time steps for time-series

Standard time resolution for all CGG distribution studies is **15-minute intervals** (96 steps per day). This matches the resolution of most utility metering data.

---

## 13. Open Questions / TODO

- [ ] **Pyodide compatibility:** Verify that pandapower (from PyPI latest) installs cleanly via micropip in Pyodide 0.27+. Test specifically: scipy, networkx, pandas interaction.
- [ ] **lightsim2grid in Pyodide:** lightsim2grid requires compiled C++ — not available in Pyodide. Confirm this and document as a known limitation of the web UI.
- [ ] **Large network performance in browser:** What is the practical bus count limit for running power flows in the browser? Need to test 10, 50, 100, 500 buses.
- [ ] **Custom controller in web UI:** Phase 2 of the web UI could allow specifying simple tap changer or PQ control. How to represent controllers in the JSON save format?
- [ ] **MV Oberrhein test case:** Can this pre-built network (included in pandapower) serve as a realistic test case for the web UI?
- [ ] **Voltage constraint coloring:** The PRD specifies 0.95–1.05 pu as the acceptable range. For 400V LV networks in the Philippines, the regulatory range may differ (±10% is common). Parametrize the limits.
- [ ] **Upstream version tracking:** Note the current upstream version when making fork changes so we can diff against future upstream releases.

---

## 14. GitHub Pages Deployment — Challenges & Reality Check

This section addresses the most fundamental question about the web UI approach:

> **"Would my virtual environment (venv) be running on GitHub Pages?"**

**Short answer: No. GitHub Pages has no Python, no venv, no server of any kind.**

Understanding this is critical before any implementation work begins.

---

### 14.1 What GitHub Pages Actually Is

GitHub Pages is a **static file hosting service**. It serves HTML, CSS, and JavaScript files — nothing else. When a visitor loads your page:

```
Browser → GitHub CDN → Delivers index.html, app.js, style.css
```

That's it. There is no machine on GitHub's side running your code. There is no Python interpreter, no pip, no venv, no Flask server, no Jupyter kernel. The files are served like a file from a USB drive.

**Implication:** All computation must happen in the visitor's own browser.

---

### 14.2 Where the venv Actually Lives

Your venv (`venv-pandapower`) is a local construct on your development machine. It:
- Lives in a directory on your disk (e.g., `/home/justin/opencode260220/pandapower/venv-pandapower/`)
- Contains a copy of Python and all installed packages
- Is only active when you explicitly activate it in a terminal
- Has zero presence on GitHub Pages after a `git push`

When you push to GitHub, you are pushing **source files only** — `.py`, `.md`, `.html`, `.js`, etc. The venv directory is (correctly) in `.gitignore` and never pushed.

```
Your machine                     GitHub Pages
─────────────────                ─────────────────────────────
venv-pandapower/  (local only)
  ├── python3.11
  ├── pandapower/                 docs/pf-web/
  ├── pandas/             push →    ├── index.html   ← served to users
  ├── scipy/                        ├── app.js
  └── ...                           └── style.css
```

---

### 14.3 Pyodide: Python Running Inside the Visitor's Browser

To run pandapower computations on a static page, we use **Pyodide** — a complete Python 3.11 runtime compiled to **WebAssembly (WASM)**.

When a visitor opens the page:
1. Their browser downloads the Pyodide runtime (~20MB, from the Pyodide CDN)
2. The browser executes Python code inside a sandboxed WASM environment
3. `micropip.install('pandapower')` installs pandapower from PyPI into that sandbox
4. `pp.runpp(net)` runs entirely on the visitor's CPU, inside their browser tab

```
Visitor's Browser Tab
─────────────────────────────────────────────────────
JavaScript (app.js)
    ↓ calls
Pyodide WASM runtime  ←── downloaded from pyodide CDN (~20MB)
    ↓ runs
Python 3.11
    ↓ imports
pandapower (installed via micropip from PyPI)
    ↓
pp.runpp(net)  ← runs on visitor's CPU, 100% client-side
    ↓
Results returned as JSON to JavaScript
    ↓
Chart.js renders the results
```

**There is no server. The visitor's computer is doing all the work.**

---

### 14.4 The Real Challenges of This Approach

#### Challenge 1: Load Time (The Biggest UX Problem)

On first visit, the browser must download:
- Pyodide runtime: ~20MB
- Python standard library (bundled with Pyodide): ~10MB
- numpy, pandas, scipy (pre-compiled WASM wheels): ~30MB total
- pandapower (pure Python wheel via micropip): ~5MB
- networkx, tqdm, deepdiff, and other pandapower dependencies

**Total cold start: 50–80MB download, 20–60 seconds on a typical connection.**

After the first visit, the browser caches most of this. Subsequent visits are much faster (~3–5 seconds). But the first impression is rough.

**Mitigation options:**
- Show a detailed progress bar so the user knows it's loading, not broken
- Use a Service Worker to pre-cache Pyodide in the background on first visit
- Consider hosting a stripped-down pandapower that excludes unused features (reduces size)
- Display a "while you wait" message explaining what's happening

#### Challenge 2: C Extension Packages Don't Work in Pyodide

Pyodide only runs packages that have been compiled to WebAssembly. Many pandapower optional dependencies are **C extensions that are NOT available in Pyodide**:

| Package | Status in Pyodide | Impact |
|---|---|---|
| `numpy` | ✅ Available | Core math — works |
| `pandas` | ✅ Available | DataFrames — works |
| `scipy` | ✅ Available | Sparse matrices — works |
| `networkx` | ✅ Available (pure Python) | Graph topology — works |
| `numba` | ❌ Not available | No JIT acceleration |
| `lightsim2grid` | ❌ Not available | No C++ speed boost |
| `matplotlib` | ⚠️ Partial | Static rendering only, no interactive window |
| `plotly` | ✅ Available | Interactive charts work |
| `PowerGridModel` | ❌ Not available | C++ library |

**Bottom line:** The web UI runs pandapower in "pure Python mode" — using the standard Newton-Raphson solver without Numba or lightsim2grid acceleration. This is fine for small-to-medium networks (< 100 buses) but will be noticeably slow for larger ones.

#### Challenge 3: No File System Access

Pyodide runs in a sandboxed browser environment with no access to the real file system. This means:

- `pp.to_json(net, "/some/path/network.json")` won't write to the user's disk
- `pp.from_json("/some/path/network.json")` can't read from disk

**Workaround:** Use Pyodide's in-memory file system for intermediate storage, then hand the result back to JavaScript as a JSON string and trigger a browser download:

```javascript
// JavaScript side — trigger file download from a JSON string
function downloadJSON(jsonStr, filename) {
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
}
```

```python
# Python side — serialize to string, not file
import pandapower as pp, json
json_str = pp.to_json(net)   # returns string when no path given
json_str  # returned to JavaScript via Pyodide
```

#### Challenge 4: Memory Limits in the Browser

Browsers enforce memory limits per tab (typically 1–4GB depending on device). A large pandapower network with many time-series steps can exhaust this:

- A 500-bus network × 8760 time steps × storing 5 result columns = hundreds of MB of result data
- The Pyodide runtime itself occupies ~150MB of baseline memory

**Practical limit for the web UI:** Networks up to ~100 buses, time-series up to 96–288 steps (1–3 days at 15-min resolution). Anything larger should be done locally with the full Python install.

#### Challenge 5: No Persistent State Between Page Reloads

Every time the user reloads the page, Pyodide re-initializes from scratch. All network objects, results, and Python variables are gone. The only persistence available is:

- `localStorage` — store JSON strings (up to ~5MB per origin)
- File download — save JSON to user's computer

The JSON save/load feature in the PRD addresses this for network definitions, but results must be downloaded before the page is closed.

#### Challenge 6: micropip Installs PyPI Version, Not CGG Fork

When the web UI runs `micropip.install('pandapower')`, it installs **the latest upstream pandapower from PyPI** — not the CGG fork. Any modifications made in the CGG fork are not present in the web UI.

**This is intentional** (see fork decision §12) — the web UI is a standalone educational tool. But it means:
- If we add a custom element type to the CGG fork, it won't be in the web UI
- If upstream releases a breaking change, the web UI silently upgrades on next load

**Mitigation:** Pin the micropip install to a specific pandapower version:
```python
await micropip.install('pandapower==3.0.0')  # pin exact version
```

#### Challenge 7: Debugging is Hard

When pandapower crashes inside Pyodide:
- The Python traceback is in the browser's JavaScript console (F12 → Console)
- It's verbose and unfamiliar to users
- Stack traces reference internal pandapower files the user doesn't have

**Mitigation:** Wrap all `runpp()` calls in try/except and return clean, plain-English error messages. Never surface raw Python tracebacks to end users.

```python
try:
    pp.runpp(net)
except pp.powerflow.LoadflowNotConverged:
    return json.dumps({"error": "power_flow_not_converged",
                       "message": "The power flow did not converge. Try reducing load values or checking for isolated buses."})
except Exception as e:
    return json.dumps({"error": "unknown",
                       "message": f"An unexpected error occurred: {type(e).__name__}"})
```

#### Challenge 8: GitHub Pages Deployment Gotchas

Even though the output is static files, there are deployment-specific issues:

- **Base URL paths:** If the app is at `/pandapower/pf-web/`, relative URLs in JavaScript must account for the subdirectory. Use `<base href="/pandapower/pf-web/">` or make all asset URLs absolute.
- **CORS for Pyodide CDN:** Pyodide loads from a CDN. If the CDN URL ever changes, the load will silently fail. Always pin the Pyodide version:
  ```html
  <script src="https://cdn.jsdelivr.net/pyodide/v0.27.0/full/pyodide.js"></script>
  ```
- **GitHub Pages caching:** GitHub Pages has aggressive CDN caching. After pushing changes to `docs/`, the live site may take 1–5 minutes to update.
- **Large files:** If any vendored JS files exceed GitHub's 100MB file limit (unlikely here), the push will fail.
- **Jekyll interference:** GitHub Pages runs Jekyll by default and may try to process files. Add a `.nojekyll` file in `docs/` to disable this:
  ```bash
  touch docs/.nojekyll
  ```

---

### 14.5 The Alternative: A Backend Server

If the Pyodide approach proves too slow or limited, the alternative is a proper backend:

| Approach | Pros | Cons |
|---|---|---|
| **Pyodide (current plan)** | Zero server cost, static hosting, no auth | Slow load, limited packages, browser memory limits |
| **Flask/FastAPI on a VPS** | Full Python, fast, can use full pandapower | Requires server ($5–20/month), maintenance, security |
| **Render / Railway free tier** | Managed hosting, easy deploy | Cold start delays on free tier, usage limits |
| **Google Colab link** | Free, full Python, no setup | Not a real UI — opens notebook, not beginner-friendly |

**CGG decision:** Start with Pyodide for the educational/demo use case. If CGG needs to run large studies or use the CGG fork's custom features, the tool should be run locally with the full Python install — not in the browser.

---

### 14.6 Summary: What the Deployment Model Means for Users

| Question | Answer |
|---|---|
| Is there a server running? | No |
| Is my venv used? | No — your venv is local-only |
| Who runs the Python code? | The visitor's own browser |
| What version of pandapower runs? | Latest from PyPI (not CGG fork) |
| Can it handle 500 buses? | Probably not reliably |
| What happens when I close the tab? | All results lost unless downloaded |
| What happens if GitHub goes down? | Tool is unavailable |
| Does it cost anything to host? | No — GitHub Pages is free |
| How do I run the CGG fork's features? | Locally, with the full Python install |

---

*Added: 2026-03-25*

---

## Changelog

| Date | Author | Entry |
|---|---|---|
| 2026-03-25 | CGG | Initial document created — populated with knowledge from initial pandapower analysis and web UI PRD development |

---

*See also: [How this Works.md](./How%20this%20Works.md) | [Experimental Power Flow (Load Flow) Analysis PRD.md](./Experimental%20Power%20Flow%20%28Load%20Flow%29%20Analysis%20PRD.md)*
