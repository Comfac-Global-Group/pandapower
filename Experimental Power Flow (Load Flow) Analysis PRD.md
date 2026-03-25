# Product Requirements Document
## Experimental Power Flow (Load Flow) Analysis
### GitHub Pages Web UI — Compartmentalized

**Document type:** PRD
**Status:** Draft v1.0
**Date:** 2026-03-25
**Owner:** Comfac Global Group (CGG)
**Scope:** Standalone GitHub Pages app — NO upstream pandapower dependency at runtime
**Not for merge:** This tool is CGG-internal. It does not contribute back to `e2nIEE/pandapower`.

---

## Table of Contents

1. [Purpose & Problem Statement](#1-purpose--problem-statement)
2. [Goals & Non-Goals](#2-goals--non-goals)
3. [User Personas](#3-user-personas)
4. [Product Overview](#4-product-overview)
5. [Functional Requirements](#5-functional-requirements)
6. [UI/UX Specification](#6-uiux-specification)
7. [Technical Architecture](#7-technical-architecture)
8. [Data Schemas](#8-data-schemas)
9. [Output Specification](#9-output-specification)
10. [Default / Recommended Inputs](#10-default--recommended-inputs)
11. [Automated Time-Series Mode](#11-automated-time-series-mode)
12. [Implementation Plan](#12-implementation-plan)
13. [Acceptance Criteria](#13-acceptance-criteria)
14. [Appendix: Pandapower Python Reference](#14-appendix-pandapower-python-reference)

---

## 1. Purpose & Problem Statement

### The gap

Pandapower is a powerful Python library, but to use it an analyst must:
- Install Python, pandapower, and its dependencies
- Write Python code to define the network
- Write more code to run the analysis
- Write yet more code to display results

This creates a high barrier. Project engineers, students, and non-Python-fluent analysts cannot use pandapower without developer support.

### The solution

A **self-contained, static web application** hosted on GitHub Pages that:
- Presents a guided form for encoding a power network
- Pre-fills all inputs with **working recommended values** (clearly marked as replaceable)
- Calls pandapower via **Pyodide** (Python in WebAssembly) directly in the browser — no server required
- Always generates an output, even with default values
- Displays results clearly in tables and charts

**The app is deliberately limited** to the most valuable analysis type: **AC Power Flow (Load Flow)**, with an optional **Automated Time-Series** mode.

---

## 2. Goals & Non-Goals

### Goals

- **G1:** Any analyst can run a power flow in under 5 minutes without writing code
- **G2:** The tool always produces output — default inputs are valid and complete
- **G3:** Inputs are clearly labeled with units, valid ranges, and replacement guidance
- **G4:** Results are understandable without a power systems background
- **G5:** The tool works entirely in the browser (GitHub Pages — no backend)
- **G6:** The tool is compartmentalized — zero coupling to CGG's production systems
- **G7:** An experienced user can save/load network configurations as JSON

### Non-Goals

- **NG1:** Full network editor / diagrammatic drawing tool (not in scope)
- **NG2:** Optimal Power Flow, Short Circuit, State Estimation (Phase 2+)
- **NG3:** Multi-user collaboration or cloud storage
- **NG4:** Real-time or SCADA data integration
- **NG5:** Three-phase asymmetric analysis
- **NG6:** Contributing changes back to upstream pandapower

---

## 3. User Personas

### Persona A: The Curious Engineer
- Background in electrical engineering, but not a Python developer
- Wants to validate a rough feeder design
- Needs to understand voltage drop and line loading
- Will replace default inputs with their own values

### Persona B: The Student / Trainee
- Learning power systems concepts
- Needs guided examples that always work
- Will use default inputs first, then explore what-if changes
- Needs plain-English result interpretation

### Persona C: The Experienced Analyst
- Comfortable with pandapower and Python
- Uses the web UI for quick sanity checks
- Will load/save JSON configs between sessions
- Needs to see raw result tables and export to CSV

---

## 4. Product Overview

### Name
**CGG PowerFlow Web** (internal name: `pf-web`)

### Deployment
- GitHub Pages from `Comfac-Global-Group/pandapower` repository
- Path: `docs/pf-web/index.html` (or a separate `gh-pages` branch)
- URL pattern: `https://comfac-global-group.github.io/pandapower/pf-web/`

### Technology
- **Frontend:** Vanilla HTML + CSS + JavaScript (or lightweight React — decision in §7)
- **Python runtime:** [Pyodide](https://pyodide.org) — runs `pandapower` via WebAssembly in the browser
- **No build server / no backend**

### Mode selector
The UI has two modes selectable at the top:

| Mode | Description |
|---|---|
| **Single Power Flow** | One snapshot — fill in the network, click Run, see results |
| **Time-Series Power Flow** | Sequential runs — add load/generation profiles, simulate over time |

---

## 5. Functional Requirements

### FR-PF-001: Network Builder — Buses

The user can define a list of buses. Each bus has:

| Field | Type | Unit | Default | Notes |
|---|---|---|---|---|
| Name | string | — | `"Bus 1"` | User-friendly label |
| Nominal voltage | number | kV | `11` | Must be > 0 |
| In service | boolean | — | `true` | Deselect to remove from calculation |

Minimum: 2 buses. Maximum: 50 buses (UI limit for performance).

---

### FR-PF-002: Network Builder — Lines

The user can define lines connecting buses. Each line has:

| Field | Type | Unit | Default | Notes |
|---|---|---|---|---|
| From bus | select | — | Bus 1 | |
| To bus | select | — | Bus 2 | |
| Length | number | km | `2.0` | |
| Standard type | select | — | `"NAYY 4x150 SE"` | From pandapower std_types |
| In service | boolean | — | `true` | |

Alternative: **Manual impedance entry** (advanced mode):

| Field | Type | Unit | Default |
|---|---|---|---|
| R per km | number | Ω/km | `0.206` |
| X per km | number | Ω/km | `0.080` |
| C per km | number | nF/km | `261` |
| Max current | number | kA | `0.270` |

---

### FR-PF-003: Network Builder — External Grid (Slack)

One external grid connection (slack bus) must exist. Fields:

| Field | Type | Unit | Default | Notes |
|---|---|---|---|---|
| Bus | select | — | Bus 1 | Must be one of the defined buses |
| Voltage magnitude | number | pu | `1.02` | Grid voltage set-point |
| Min voltage | number | pu | `0.95` | For constraint display |
| Max voltage | number | pu | `1.05` | For constraint display |

---

### FR-PF-004: Network Builder — Loads

The user can add multiple loads. Each load has:

| Field | Type | Unit | Default | Notes |
|---|---|---|---|---|
| Bus | select | — | Bus 2 | |
| Active power | number | MW | `1.0` | Positive = consumption |
| Reactive power | number | MVAr | `0.3` | Can be negative (capacitive) |
| Name | string | — | `"Load 1"` | |
| In service | boolean | — | `true` | |

---

### FR-PF-005: Network Builder — Static Generators (Sgen)

Optional. For solar PV, wind, or embedded generation:

| Field | Type | Unit | Default | Notes |
|---|---|---|---|---|
| Bus | select | — | Bus 2 | |
| Active power | number | MW | `0.5` | Positive = injection |
| Reactive power | number | MVAr | `0.0` | |
| Name | string | — | `"Solar 1"` | |
| In service | boolean | — | `true` | |

---

### FR-PF-006: Network Builder — Transformers (Optional)

Optional two-winding transformer:

| Field | Type | Unit | Default | Notes |
|---|---|---|---|---|
| HV bus | select | — | Bus 1 | |
| LV bus | select | — | Bus 2 | |
| Standard type | select | — | `"0.25 MVA 11/0.4 kV"` | From pandapower std_types |
| Tap position | integer | — | `0` | Range: typ. -2 to +2 |
| In service | boolean | — | `true` | |

---

### FR-PF-007: Run Power Flow

A prominent **"Run Power Flow"** button triggers the analysis.

The button is:
- Enabled when at least 2 buses, 1 line, 1 ext_grid, and 1 load are defined
- Disabled while analysis is running (shows spinner)
- Shows a "Generating output..." progress message during Pyodide execution

The system must **always produce an output** when using default/recommended values.

---

### FR-PF-008: Results Display

After a successful run, display:

#### Bus Results Table

| Bus | Name | Voltage (pu) | Angle (°) | P (MW) | Q (MVAr) | Status |
|---|---|---|---|---|---|---|
| Colored green/amber/red based on voltage limits |

Voltage coloring:
- Green: `0.95 pu ≤ vm_pu ≤ 1.05 pu`
- Amber: `0.90 pu ≤ vm_pu < 0.95 pu` or `1.05 < vm_pu ≤ 1.10 pu`
- Red: outside amber range

#### Line Results Table

| Line | From → To | Current (A) | Loading (%) | P from (MW) | P to (MW) | Losses (kW) | Status |
|---|---|---|---|---|---|---|---|
| Color-coded by loading_percent: <70% green, 70-90% amber, >90% red |

#### Summary Cards

Four summary metrics displayed prominently:
1. **Convergence** — Converged / Did Not Converge (with iteration count)
2. **Lowest bus voltage** — value and bus name
3. **Highest line loading** — value and line name
4. **Total losses** — active power losses in MW

---

### FR-PF-009: Voltage Profile Chart

A bar chart showing voltage (pu) at each bus, with:
- Horizontal dashed lines at 0.95 and 1.05 pu
- Bars colored green/amber/red by the same voltage rules
- Bus names on x-axis

---

### FR-PF-010: Error Handling — Non-Convergence

If the power flow does not converge:
- Show a red banner: "Power flow did not converge after N iterations"
- Display a diagnostic message: list likely causes (isolated bus, extreme loading, etc.)
- Do NOT show result tables (they would be meaningless)
- Suggest: reduce load P/Q values, check connectivity

---

### FR-PF-011: JSON Save / Load

A **Save Configuration** button serializes the current network definition (not results) to JSON and triggers a browser download.

A **Load Configuration** button accepts a JSON file and repopulates all form fields.

JSON format is specified in §8.

---

### FR-PF-012: Generated Python Code Export

A **"View Python Code"** panel shows the equivalent pandapower Python code for the current network definition. This is read-only and intended for educational purposes and for running locally.

---

### FR-PF-013: Recommended Inputs Highlight

All default/recommended values are displayed with a **yellow highlight** and a tooltip:
`"Recommended value — replace with your actual data"`

The highlight disappears when the user edits the field.

---

## 6. UI/UX Specification

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│  CGG PowerFlow Web                    [Single] [Time-Series] │
│  Experimental Power Flow Analysis                           │
├──────────────────────────┬──────────────────────────────────┤
│                          │                                  │
│   NETWORK DEFINITION     │   RESULTS                        │
│   ─────────────────      │   ───────                        │
│   [+] Buses              │   (empty until Run is clicked)   │
│   [+] Lines              │                                  │
│   [+] External Grid      │   After run:                     │
│   [+] Loads              │   ┌─ Summary Cards ─────────┐   │
│   [+] Generators         │   └────────────────────────-┘   │
│   [+] Transformers       │   ┌─ Bus Voltage Chart ─────┐   │
│                          │   └─────────────────────────┘   │
│   [Run Power Flow] ►     │   ┌─ Bus Results Table ─────┐   │
│                          │   └─────────────────────────┘   │
│   [Save] [Load] [Code]   │   ┌─ Line Results Table ────┐   │
│                          │   └─────────────────────────┘   │
└──────────────────────────┴──────────────────────────────────┘
```

### Responsive behavior
- Desktop: two-column layout as above
- Mobile: single column, network definition above results

### Pyodide loading state
On first page load, Pyodide must download (~20MB). Display:
```
Loading Python runtime...  [████████░░] 80%
```
The Run button is disabled until Pyodide is ready.

### Standard type dropdowns

**Line standard types (pre-loaded):**
```
NAYY 4x50 SE     (LV distribution — light)
NAYY 4x150 SE    (LV distribution — medium)  ← DEFAULT
NAYY 4x185 SE    (LV distribution — heavy)
NA2XS2Y 1x185 RM/25 12/20 kV  (MV cable)
N2XS(FL)2Y 1x300 RM/35 64/110 kV  (HV cable)
149-AL1/24-ST1A 10.0  (overhead line)
```

**Transformer standard types (pre-loaded):**
```
0.25 MVA 11/0.4 kV    ← DEFAULT (11kV to LV)
0.63 MVA 11/0.4 kV
1.6 MVA 11/0.4 kV
6.3 MVA 33/11 kV
```

---

## 7. Technical Architecture

### Option A: Pyodide + Vanilla JS (Recommended)

```
index.html
  ├── style.css            (Tailwind CDN or hand-rolled)
  ├── app.js               (UI logic, form management)
  ├── pyodide-runner.js    (Pyodide lifecycle, Python code execution)
  └── chart.js             (Chart.js CDN for voltage chart)

Pyodide loads in the browser:
  - Python 3.11 WASM
  - micropip installs pandapower (+ scipy, numpy, networkx, pandas)
  - Python code is generated from form state and eval'd
  - Results returned as JSON to JS
```

**Pros:** No build step, deployable as static files, no framework
**Cons:** Pyodide load time (~20-30s first visit, cached after)

### Option B: Precomputed + Pyodide hybrid

For the time-series mode only: pre-generate a matrix of outputs for the default scenario, show them instantly while Pyodide loads in the background.

### File structure for GitHub Pages deployment

```
docs/
└── pf-web/
    ├── index.html
    ├── app.js
    ├── pyodide-runner.js
    ├── style.css
    ├── chart.min.js        (vendored)
    └── default-config.json (pre-loaded example network)
```

In `_config.yml` (or repo settings): set Pages source to `/docs`.

### Pyodide execution flow

```javascript
// pyodide-runner.js

async function loadPyodide() {
    window.pyodide = await loadPyodide();
    await pyodide.loadPackage(['numpy', 'pandas', 'scipy', 'networkx']);
    await pyodide.runPythonAsync(`
        import micropip
        await micropip.install('pandapower')
    `);
}

async function runPowerFlow(networkConfig) {
    const pythonCode = generatePythonCode(networkConfig);
    const result = await pyodide.runPythonAsync(pythonCode);
    return JSON.parse(result);
}
```

### Python code generation pattern

```javascript
function generatePythonCode(config) {
    return `
import pandapower as pp
import json

net = pp.create_empty_network()

${config.buses.map((b, i) =>
    `b${i} = pp.create_bus(net, vn_kv=${b.vn_kv}, name="${b.name}")`
).join('\n')}

${config.ext_grid ? `pp.create_ext_grid(net, b${config.ext_grid.bus_idx}, vm_pu=${config.ext_grid.vm_pu})` : ''}

${config.lines.map(l =>
    `pp.create_line(net, b${l.from_bus}, b${l.to_bus}, length_km=${l.length_km}, std_type="${l.std_type}")`
).join('\n')}

${config.loads.map(l =>
    `pp.create_load(net, b${l.bus_idx}, p_mw=${l.p_mw}, q_mvar=${l.q_mvar}, name="${l.name}")`
).join('\n')}

${config.sgens.map(s =>
    `pp.create_sgen(net, b${s.bus_idx}, p_mw=${s.p_mw}, q_mvar=${s.q_mvar}, name="${s.name}")`
).join('\n')}

try:
    pp.runpp(net, algorithm='nr', tolerance_mva=1e-8)
    result = {
        "converged": True,
        "iterations": int(net._ppc.get("iterations", 0)),
        "res_bus": net.res_bus[['vm_pu','va_degree','p_mw','q_mvar']].to_dict(orient='records'),
        "res_line": net.res_line[['p_from_mw','q_from_mvar','p_to_mw','q_to_mvar',
                                   'pl_mw','ql_mvar','i_from_ka','loading_percent']].to_dict(orient='records'),
        "bus_names": net.bus['name'].tolist()
    }
except Exception as e:
    result = {"converged": False, "error": str(e)}

json.dumps(result)
`;
}
```

---

## 8. Data Schemas

### Network Configuration JSON (save/load format)

```json
{
  "version": "1.0",
  "name": "My Feeder Study",
  "buses": [
    { "name": "Grid Substation", "vn_kv": 11, "in_service": true },
    { "name": "Bus A",           "vn_kv": 11, "in_service": true },
    { "name": "Bus B",           "vn_kv": 11, "in_service": true }
  ],
  "ext_grid": {
    "bus_idx": 0,
    "vm_pu": 1.02,
    "min_vm_pu": 0.95,
    "max_vm_pu": 1.05
  },
  "lines": [
    { "from_bus": 0, "to_bus": 1, "length_km": 2.0, "std_type": "NAYY 4x150 SE", "in_service": true },
    { "from_bus": 1, "to_bus": 2, "length_km": 1.0, "std_type": "NAYY 4x150 SE", "in_service": true }
  ],
  "loads": [
    { "bus_idx": 1, "p_mw": 1.0, "q_mvar": 0.3, "name": "Load A", "in_service": true },
    { "bus_idx": 2, "p_mw": 0.5, "q_mvar": 0.1, "name": "Load B", "in_service": true }
  ],
  "sgens": [],
  "trafos": [],
  "mode": "single"
}
```

### Time-Series Extension

```json
{
  "...": "all fields from above",
  "mode": "timeseries",
  "timeseries": {
    "n_steps": 96,
    "step_duration_minutes": 15,
    "load_profiles": [
      {
        "load_idx": 0,
        "variable": "p_mw",
        "values": [0.2, 0.3, 0.4, "...96 values..."]
      }
    ],
    "sgen_profiles": [
      {
        "sgen_idx": 0,
        "variable": "p_mw",
        "values": [0.0, 0.0, "...96 values..."]
      }
    ]
  }
}
```

---

## 9. Output Specification

The tool must always produce the following outputs after a successful run:

### Single Power Flow Output

1. **Convergence banner** — green "Converged in N iterations" or red "Did not converge"
2. **Summary cards** (4 cards):
   - Convergence status
   - Min bus voltage [pu] with bus name
   - Max line loading [%] with line name
   - Total active losses [kW]
3. **Voltage profile chart** — bar chart, buses on x-axis, voltage pu on y-axis
4. **Bus results table** — all buses with color coding
5. **Line results table** — all lines with color coding
6. **Python code panel** — collapsible, shows equivalent code

### Time-Series Output

1. **Voltage over time chart** — line chart, one line per bus, time steps on x-axis
2. **Line loading over time chart** — line chart, one line per network line
3. **Violation summary** — count of time steps where voltage < 0.95 or > 1.05, and loading > 90%
4. **Min/max statistics table** — worst-case values per bus and line
5. **Downloadable CSV** — full time-series results

---

## 10. Default / Recommended Inputs

These defaults are carefully chosen so that **running the tool immediately with no changes always produces a valid, converged result.**

### Default network: "Simple 3-Bus 11kV Feeder"

A representative low-voltage / medium-voltage feeder — a grid substation feeding two load buses through cables.

**Buses:**
| # | Name | Voltage |
|---|---|---|
| 0 | Grid Substation | 11 kV |
| 1 | Bus A — Residential Area | 11 kV |
| 2 | Bus B — Commercial Block | 11 kV |

**External Grid:**
| Parameter | Value | Note |
|---|---|---|
| Connected bus | Bus 0 | Slack bus |
| Voltage | 1.02 pu | Slightly above nominal |

**Lines:**
| From | To | Length | Type | Note |
|---|---|---|---|---|
| Bus 0 | Bus A | 2.0 km | NAYY 4x150 SE | Main feeder |
| Bus A | Bus B | 1.0 km | NAYY 4x150 SE | Branch |

**Loads:**
| Bus | P (MW) | Q (MVAr) | Note |
|---|---|---|---|
| Bus A | 1.0 | 0.3 | Represents ~2,000 residential customers |
| Bus B | 0.5 | 0.1 | Represents commercial load |

**Expected results with defaults:**
- Bus A voltage: ~0.985 pu (slightly below nominal)
- Bus B voltage: ~0.978 pu
- Main feeder loading: ~35%
- Branch loading: ~17%
- Total losses: ~12 kW

These expected values are shown as a reference panel so the user knows the tool is working correctly.

---

## 11. Automated Time-Series Mode

### Purpose

Simulate a full 24-hour day at 15-minute intervals (96 time steps) with realistic load and solar generation profiles.

### Default time-series scenario: "Residential Feeder with Rooftop Solar"

**Load profile** (MW, 96 steps):
- Overnight (0:00–6:00): 0.2 MW
- Morning peak (7:00–9:00): 0.8 MW
- Daytime (9:00–17:00): 0.5 MW
- Evening peak (18:00–21:00): 1.0 MW
- Late evening (21:00–24:00): 0.4 MW

**Solar profile** (MW, 96 steps):
- Night (0:00–6:00 and 18:00–24:00): 0.0 MW
- Morning ramp (6:00–9:00): rising to 0.6 MW
- Peak (10:00–14:00): 0.8 MW
- Afternoon decline (14:00–18:00): falling to 0.0 MW

### Time-series UI additions

- **Profile editor:** paste 96 comma-separated values OR select from presets
- **Preset profiles available:**
  - Residential load (weekday)
  - Residential load (weekend)
  - Commercial load (weekday)
  - Rooftop solar (clear day)
  - Rooftop solar (cloudy day)
- **Chart view:** toggle between voltage timeline and loading timeline
- **Violation counter:** "X of 96 time steps had voltage violations"

---

## 12. Implementation Plan

### Phase 1: Core Single Power Flow (MVP)

| Task | Description |
|---|---|
| P1-T1 | Set up `docs/pf-web/` structure in CGG fork |
| P1-T2 | Implement Pyodide loader with progress indicator |
| P1-T3 | Build bus/line/load form with default values |
| P1-T4 | Implement Python code generator from form state |
| P1-T5 | Implement result display (tables + summary cards) |
| P1-T6 | Implement voltage profile chart (Chart.js) |
| P1-T7 | Implement JSON save/load |
| P1-T8 | Implement "View Python Code" panel |
| P1-T9 | Deploy to GitHub Pages and verify |

**MVP acceptance:** User can run the default network, see converged results, and verify against expected values.

### Phase 2: Time-Series Mode

| Task | Description |
|---|---|
| P2-T1 | Add mode toggle (Single / Time-Series) |
| P2-T2 | Profile editor (paste CSV or select preset) |
| P2-T3 | Time-series Python code generator |
| P2-T4 | Timeline charts (voltage + loading) |
| P2-T5 | Violation summary |
| P2-T6 | CSV download of full results |

### Phase 3: Enhanced Network Elements

| Task | Description |
|---|---|
| P3-T1 | Add transformer support |
| P3-T2 | Add static generator (sgen) support |
| P3-T3 | Add manual impedance entry mode |
| P3-T4 | Add shunt element support |

---

## 13. Acceptance Criteria

### AC-01: Default run always converges
Given: User opens the app with no changes
When: User clicks "Run Power Flow"
Then: The result shows "Converged", bus voltages are within 0.95–1.05 pu, line loadings are below 50%

### AC-02: Recommended inputs are visible
Given: User opens the app
Then: All default values are highlighted in yellow with tooltip "Recommended value — replace with your actual data"

### AC-03: Invalid network shows diagnostic
Given: User creates two buses with no line connecting them
When: User clicks "Run Power Flow"
Then: A message appears explaining the network has an isolated bus

### AC-04: Save/Load round-trip
Given: User defines a custom network
When: User clicks Save, then refreshes the page, then clicks Load
Then: All form fields are restored exactly as saved

### AC-05: Python code export is correct
Given: User defines a network
When: User views the Python code panel
Then: Copying and running that code in a local Python environment produces the same results as the web UI

### AC-06: Time-series produces violation summary
Given: User runs time-series mode with default profiles
When: The run completes
Then: A summary shows count of time steps with voltage violations and line overloads

### AC-07: GitHub Pages deployment
Given: The `docs/pf-web/` directory exists in the CGG fork
When: GitHub Pages is enabled
Then: The app is accessible at the expected URL and loads within 3 seconds (excluding Pyodide)

---

## 14. Appendix: Pandapower Python Reference

### Standard line types available in pandapower

```python
import pandapower as pp
net = pp.create_empty_network()
print(net.std_types['line'].keys())
```

Common types for distribution studies:
- `"NAYY 4x50 SE"` — 0.641 Ω/km, 270A capacity
- `"NAYY 4x150 SE"` — 0.206 Ω/km, 375A capacity
- `"NAYY 4x185 SE"` — 0.164 Ω/km, 420A capacity
- `"NA2XS2Y 1x185 RM/25 12/20 kV"` — MV cable

### Standard transformer types

```python
print(net.std_types['trafo'].keys())
```

Common: `"0.25 MVA 11/0.4 kV"`, `"0.63 MVA 11/0.4 kV"`, `"1.6 MVA 11/0.4 kV"`

### Result DataFrame columns

**`net.res_bus`:**
- `vm_pu` — voltage magnitude in per-unit
- `va_degree` — voltage angle in degrees
- `p_mw` — active power demand/injection at bus (consumer convention)
- `q_mvar` — reactive power demand/injection

**`net.res_line`:**
- `p_from_mw` — active power entering line at from-bus
- `p_to_mw` — active power exiting line at to-bus
- `pl_mw` — active power losses on the line
- `i_from_ka` — current at from-bus in kA
- `loading_percent` — thermal loading (0–100%+)

### Voltage limits convention

- Per-unit (pu) normalizes voltage to the nominal level
- 1.0 pu = exactly nominal voltage (e.g., 11 kV on an 11 kV bus)
- Typical acceptable range: **0.95 – 1.05 pu** (±5%)
- Violations outside this range indicate under- or over-voltage problems

---

*PRD Version 1.0 — CGG Internal — Not for upstream merge*
*See also: [How this Works.md](./How%20this%20Works.md) | [Lesson Learned Notes.md](./Lesson%20Learned%20Notes.md)*
