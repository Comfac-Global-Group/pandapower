# Pandapower Architecture & Codebase Guide

> A newcomer's guide to understanding how pandapower is organized and how to build a web-based GUI on top of it.

---

## 1. What Is Pandapower?

Pandapower is a Python library for **power system modeling and analysis**. It lets you:

- Build electrical network models (buses, lines, transformers, generators, loads, etc.)
- Run simulations (power flow, optimal power flow, short-circuit, state estimation, time series)
- Visualize results (static plots, interactive Plotly maps)
- Import/export networks (JSON, Excel, SQL, MATPOWER, CIM, PowerFactory)

Everything is built on **pandas DataFrames** — each network element type is a table, indexed by element ID. This makes it straightforward to serialize to/from JSON for a web API.

---

## 2. Project Root Layout

```
pandapower/
├── pandapower/          # Main Python package (the library itself)
├── tutorials/           # 60 Jupyter notebooks — examples & learning material
├── doc/                 # Sphinx RST documentation
├── .github/             # CI/CD workflows
├── pyproject.toml       # Dependencies, build config, Python 3.10–3.14
├── setup.py             # Minimal setuptools entry
├── README.rst
├── CHANGELOG.rst
├── AUTHORS
├── CITATION.bib
├── architecture.md      # ← This file
└── GUI_PRD.md           # Functional requirements for the web GUI
```

---

## 3. Core Package Structure (`pandapower/pandapower/`)

### 3.1 Network Creation & Data Model

| Path | Purpose |
|------|---------|
| `create/` | Element creation functions — one file per element type |
| `create/__init__.py` | Re-exports all `create_*()` functions |
| `create/bus_create.py` | `create_bus()`, `create_buses()` |
| `create/line_create.py` | `create_line()`, `create_line_from_parameters()` |
| `create/gen_create.py` | `create_gen()`, `create_gens()` |
| `create/load_create.py` | `create_load()`, `create_loads()` |
| `create/sgen_create.py` | `create_sgen()` — static generators (solar/wind) |
| `create/ext_grid_create.py` | `create_ext_grid()` — slack/reference bus |
| `create/impedance_create.py` | `create_impedance()` — series impedance |
| `create/shunt_create.py` | `create_shunt()` — capacitor banks |
| `create/switch_create.py` | `create_switch()` — breakers/isolators |
| `create/storage_create.py` | `create_storage()` — batteries |
| `create/motor_create.py` | `create_motor()` — async motors |
| `create/cost_create.py` | `create_poly_cost()`, `create_pwl_cost()` — OPF costs |
| `create/measurement_create.py` | `create_measurement()` — for state estimation |
| `create/network_create.py` | `create_empty_network()` — the starting point |
| `create/group_create.py` | `create_group()` — element grouping |
| `create/source_create.py` | DC elements, FACTS (SVC, TCSC, SSC, VSC) |

**Key concept:** A `pandapowerNet` is a dict-like object where each key (e.g., `net.bus`, `net.line`, `net.load`) is a pandas DataFrame. Results go into `net.res_bus`, `net.res_line`, etc.

### 3.2 Analysis Engines

| Path | Function | What It Does |
|------|----------|--------------|
| `run.py` | `runpp()` | **AC Power Flow** — the most-used function |
| `run.py` | `rundcpp()` | DC Power Flow (linearized approximation) |
| `run.py` | `runopp()` | AC Optimal Power Flow |
| `run.py` | `rundcopp()` | DC Optimal Power Flow |
| `run.py` | `runpp_3ph()` | Three-phase unbalanced power flow |
| `run.py` | `runpp_pgm()` | Power flow via C++ PowerGridModel backend |
| `powerflow.py` | Internal | Power flow orchestration |
| `optimal_powerflow.py` | Internal | OPF orchestration |
| `pf/` | Internal | Newton-Raphson, backward-forward sweep, Gauss-Seidel, fast-decoupled solvers |
| `shortcircuit/` | `calc_sc()` | Short-circuit analysis (IEC 60909) |
| `estimation/` | `estimate()` | State estimation (WLS, IRWLS, LP) |
| `timeseries/` | `run_time_series()` | Multi-timestep simulation |
| `contingency/` | `run_contingency()` | N-1 contingency analysis |
| `opf/` | Internal | OPF via PYPOWER / PowerModels.jl |

### 3.3 Results

| Path | Purpose |
|------|---------|
| `results.py` | Main result extraction orchestrator |
| `results_bus.py` | Bus results: voltage magnitude/angle, P/Q injection |
| `results_branch.py` | Line & trafo results: loading%, current, losses |
| `results_gen.py` | Generator results: P/Q output |

**Result tables populated after analysis:**

| Table | Key Columns |
|-------|-------------|
| `net.res_bus` | `vm_pu`, `va_degree`, `p_mw`, `q_mvar` |
| `net.res_line` | `loading_percent`, `i_from_ka`, `i_to_ka`, `pl_mw`, `ql_mvar` |
| `net.res_trafo` | `loading_percent`, `pl_mw`, `ql_mvar` |
| `net.res_load` | `p_mw`, `q_mvar` |
| `net.res_gen` | `p_mw`, `q_mvar`, `vm_pu` |
| `net.res_sgen` | `p_mw`, `q_mvar` |
| `net.res_bus_sc` | `ikss_ka`, `ip_ka`, `ith_ka` (short-circuit) |
| `net.res_bus_est` | `vm_pu`, `va_degree` (state estimation) |

### 3.4 I/O & Converters

| Path | Purpose |
|------|---------|
| `file_io.py` | `to_json()`, `from_json()`, `to_excel()`, `from_excel()` |
| `sql_io.py` | `to_sql()`, `from_sql()` — PostgreSQL, SQLite |
| `io_utils.py` | Serialization helpers |
| `converter/matpower/` | MATPOWER format import/export |
| `converter/pypower/` | PYPOWER format |
| `converter/cim/` | IEC Common Information Model |
| `converter/powerfactory/` | DIgSILENT PowerFactory |
| `converter/ucte/` | UCTE exchange format |
| `converter/jao/` | JAO format |
| `converter/pandamodels/` | Julia PowerModels.jl bridge |

### 3.5 Visualization & Plotting

| Path | Purpose |
|------|---------|
| `plotting/simple_plot.py` | `simple_plot()` — Matplotlib static plots |
| `plotting/collections.py` | Styled element collections (buses, lines, trafos) |
| `plotting/powerflow_results.py` | Color-coded result overlays |
| `plotting/geo.py` | Geographic coordinate handling |
| `plotting/to_html.py` | Export to standalone HTML |
| `plotting/plotly/` | **Interactive Plotly plots** (most relevant for web GUI) |
| `plotting/plotly/simple_plotly.py` | `simple_plotly()` — interactive network diagram |
| `plotting/plotly/mapbox_plot.py` | `mapbox_plot()` — geographic map overlay |
| `plotting/plotly/pf_res_plotly.py` | `pf_res_plotly()` — interactive results |

### 3.6 Topology & Diagnostics

| Path | Purpose |
|------|---------|
| `topology/create_graph.py` | Convert network to NetworkX graph |
| `topology/graph_searches.py` | Connected components, shortest paths, unsupplied buses |
| `diagnostic/` | Network validation: isolated buses, duplicate lines, impossible configs |

### 3.7 Advanced Features

| Path | Purpose |
|------|---------|
| `control/` | Controller framework — tap changers, DER, shunt, PQ control |
| `protection/` | Protection device modeling — fuses, relays |
| `grid_equivalents/` | Network reduction (REI, Ward equivalents) |
| `groups.py` | Batch operations on element groups |
| `std_types.py` | Standard component library (line types, trafo types) |
| `toolbox/` | Grid modification, element selection, data manipulation |

### 3.8 Internal Infrastructure

| Path | Purpose |
|------|---------|
| `__init__.py` | Public API — imports everything users need |
| `auxiliary.py` | Helpers, ADict class, logging |
| `build_bus.py` | Internal bus matrix construction |
| `build_branch.py` | Internal branch matrix construction |
| `build_gen.py` | Internal generator matrix construction |
| `pd2ppc.py` | Convert pandapower → PYPOWER internal format |
| `convert_format.py` | Version migration between pandapower versions |
| `network_schema/` | Pandera DataFrame validation schemas |
| `pypower/` | Embedded PYPOWER solver algorithms |

---

## 4. Built-In Test Networks (`pandapower/networks/`)

These are ready-made networks useful for testing the GUI:

| Function | Description | Size |
|----------|-------------|------|
| `simple_four_bus_system()` | Tiny test network | 4 buses |
| `panda_four_load_branch()` | Small LV feeder | ~10 buses |
| `case_ieee30()` | IEEE 30-bus test case | 30 buses |
| `case118()` | IEEE 118-bus test case | 118 buses |
| `case300()` | IEEE 300-bus test case | 300 buses |
| `mv_oberrhein()` | Real German MV grid | ~300 buses |
| `create_cigre_network_mv()` | CIGRE MV benchmark | ~15 buses |
| `create_kerber_*()` | Synthetic LV grids | Various |

---

## 5. Tutorials (`tutorials/`)

60 Jupyter notebooks organized by topic:

| Category | Key Notebooks |
|----------|---------------|
| **Getting Started** | `minimal_example.ipynb`, `create_simple.ipynb`, `create_advanced.ipynb` |
| **Power Flow** | `powerflow.ipynb`, `convergence_powerflow.ipynb`, `three_phase_loadflow_tutorial_simple.ipynb` |
| **OPF** | `opf_basic.ipynb`, `opf_curtail.ipynb`, `opf_dcline.ipynb` |
| **Short Circuit** | `shortcircuit.ipynb` |
| **State Estimation** | `state_estimation.ipynb` |
| **Time Series** | `time_series.ipynb`, `time_series_advanced_output.ipynb` |
| **Contingency** | `contingency_analysis.ipynb` |
| **Visualization** | `plotting_basic.ipynb`, `plotly_built-in.ipynb`, `plotly_maps.ipynb` |
| **Controls** | `control_loop.ipynb`, `building_a_controller.ipynb`, `DER_control_tutorial.ipynb` |
| **Protection** | `protection/fuse.ipynb`, `protection/oc_relay.ipynb` |
| **Converters** | `cim2pp.ipynb`, `converter_powerfactory.ipynb` |

---

## 6. Dependencies

**Core (always required):**
- `pandas ~= 2.3` — DataFrames (the foundation)
- `numpy >= 1.26` — Numerical arrays
- `scipy < 1.17` — Sparse matrices, solvers
- `networkx ~= 3.4` — Graph/topology algorithms
- `tqdm ~= 4.67` — Progress bars
- `geojson ~= 3.2` — GeoJSON support
- `pandera ~= 0.26` — DataFrame validation

**Visualization (relevant for GUI):**
- `plotly ~= 6.3` — Interactive web-based plots
- `matplotlib ~= 3.10` — Static plots
- `geopandas ~= 1.1` — Geographic data

**Performance:**
- `numba ~= 0.61` — JIT-compiled solvers
- `lightsim2grid ~= 0.12` — C++ power flow backend

**I/O:**
- `xlsxwriter`, `openpyxl` — Excel
- `psycopg ~= 3.2` — PostgreSQL
- `lxml ~= 6.0` — XML parsing

---

## 7. How Pandapower Works (The Computation Flow)

```
┌─────────────────────────────────────────────────────┐
│  1. CREATE NETWORK                                  │
│     net = pp.create_empty_network()                 │
│     pp.create_bus(net, vn_kv=110)                   │
│     pp.create_line(net, from_bus=0, to_bus=1, ...)  │
│     pp.create_load(net, bus=1, p_mw=10)             │
│     ...                                             │
│     → net.bus, net.line, net.load are DataFrames    │
└───────────────────────┬─────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│  2. RUN ANALYSIS                                    │
│     pp.runpp(net)           # Power flow            │
│     pp.runopp(net)          # Optimal power flow    │
│     pp.shortcircuit.calc_sc(net)  # Short circuit   │
│     pp.estimation.estimate(net)   # State est.      │
│                                                     │
│     → Internally: DataFrames → sparse matrices →    │
│       solver → results back to DataFrames           │
└───────────────────────┬─────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│  3. READ RESULTS                                    │
│     net.res_bus      → voltage, power at each bus   │
│     net.res_line     → loading, current, losses     │
│     net.res_trafo    → loading, losses              │
│     net.converged    → True/False                   │
│                                                     │
│     → All results are pandas DataFrames             │
└───────────────────────┬─────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│  4. VISUALIZE / EXPORT                              │
│     pp.plotting.simple_plotly(net)   # Web plot     │
│     pp.to_json(net)                  # Serialize    │
│     pp.to_excel(net, "network.xlsx") # Export       │
└─────────────────────────────────────────────────────┘
```

---

## 8. Key Architecture Facts for GUI Developers

### 8.1 Everything Is a DataFrame
- Input data: `net.bus`, `net.line`, `net.trafo`, `net.load`, `net.gen`, `net.sgen`, `net.ext_grid`, `net.switch`, `net.shunt`, `net.storage`, etc.
- Result data: `net.res_bus`, `net.res_line`, `net.res_trafo`, etc.
- Both are pandas DataFrames — trivially convertible to JSON via `.to_dict(orient="records")` or `.to_json()`.

### 8.2 JSON Serialization Is Built In
```python
json_str = pp.to_json(net)       # Network → JSON string
net = pp.from_json(json_str)     # JSON string → Network
```
This is the natural transport format for a REST API.

### 8.3 Analysis Is Stateless (Almost)
- Call `runpp(net)` → results appear in `net.res_*` tables
- Call it again → previous results are overwritten
- The `net` object carries all state — pass it around as the single source of truth

### 8.4 Plotly Is Already Web-Ready
- `pandapower.plotting.plotly` generates Plotly figures
- Plotly figures serialize to JSON natively
- They can be rendered directly in a browser via `plotly.js`

### 8.5 Standard Types Are a Built-In Library
- `net.std_types["line"]` — DataFrame of line types with impedance/capacity data
- `net.std_types["trafo"]` — DataFrame of transformer types
- When creating elements, pass `std_type="NAYY 4x50 SE"` to auto-populate parameters
- GUI should present these as dropdowns

### 8.6 Controllers Run Inside Power Flow
- `runpp(net, run_control=True)` activates the controller loop
- Controllers (tap changers, DER control) iterate until convergence
- For the GUI: expose controller configuration as a settings panel

---

## 9. Recommended Web GUI Tech Stack

For a Python-backend web GUI wrapping pandapower:

```
┌──────────────────────────────────────┐
│  Frontend (Browser)                  │
│  - React / Vue / Svelte              │
│  - Plotly.js for network diagrams    │
│  - AG Grid or similar for tables     │
│  - PDF generation (jsPDF / pdfmake)  │
└──────────────┬───────────────────────┘
               │ REST / WebSocket
               ▼
┌──────────────────────────────────────┐
│  Backend (Python)                    │
│  - FastAPI or Flask                  │
│  - pandapower as the engine          │
│  - Endpoints for CRUD + analysis     │
│  - Session/project management        │
└──────────────────────────────────────┘
```

**API Design Sketch:**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/network` | POST | Create new empty network |
| `/api/network` | GET | Get current network as JSON |
| `/api/network/import` | POST | Import from JSON/Excel/MATPOWER |
| `/api/network/export` | GET | Export to JSON/Excel |
| `/api/element/{type}` | POST | Create element (bus, line, load...) |
| `/api/element/{type}/{id}` | PUT | Update element parameters |
| `/api/element/{type}/{id}` | DELETE | Remove element |
| `/api/analysis/powerflow` | POST | Run power flow |
| `/api/analysis/opf` | POST | Run optimal power flow |
| `/api/analysis/shortcircuit` | POST | Run short-circuit analysis |
| `/api/analysis/estimation` | POST | Run state estimation |
| `/api/analysis/timeseries` | POST | Run time series |
| `/api/analysis/contingency` | POST | Run contingency analysis |
| `/api/results/{type}` | GET | Get result tables |
| `/api/plot/network` | GET | Get Plotly figure JSON |
| `/api/report/{type}` | GET | Generate PDF report |
| `/api/stdtypes/{element}` | GET | List standard types |
| `/api/diagnostic` | POST | Run network diagnostics |
| `/api/topology` | GET | Get topology info |

---

## 10. Quick Reference: Most Important Files

If you're building a GUI and need to understand pandapower, read these files in order:

1. **`pandapower/__init__.py`** — See every public function
2. **`pandapower/run.py`** — Power flow & OPF entry points
3. **`pandapower/create/__init__.py`** — All element creation functions
4. **`pandapower/file_io.py`** — JSON/Excel serialization
5. **`pandapower/results.py`** — How results are extracted
6. **`pandapower/plotting/plotly/simple_plotly.py`** — Interactive visualization
7. **`pandapower/shortcircuit/calc_sc.py`** — Short-circuit entry point
8. **`pandapower/estimation/state_estimation.py`** — State estimation entry point
9. **`pandapower/timeseries/run_time_series.py`** — Time series entry point
10. **`pandapower/networks/power_system_test_cases.py`** — Built-in test networks
