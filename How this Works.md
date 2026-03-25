# How Pandapower Works

> **Audience:** Engineers, analysts, and curious contributors who want to understand, use, and mod pandapower — without necessarily having a power systems PhD.
>
> **Fork context:** This document is maintained within the **Comfac Global Group (CGG)** fork. This fork is compartmentalized — it is not intended to merge upstream into `e2nIEE/pandapower`. All modifications, experiments, and UI tooling are standalone.

---

## Table of Contents

1. [High-Level Layman's Overview](#1-high-level-laymans-overview)
2. [What the App Actually Does](#2-what-the-app-actually-does)
3. [Component Inventory](#3-component-inventory)
4. [Detailed Module Explanations](#4-detailed-module-explanations)
5. [Experimentation & Testing](#5-experimentation--testing)
6. [Simple Power Flow Workflow](#6-simple-power-flow-workflow)
7. [Automated Time-Series Power Flow](#7-automated-time-series-power-flow)
8. [Related Documents](#8-related-documents)

---

## 1. High-Level Layman's Overview

Imagine you are managing an electrical grid — a network of power plants, cables, transformers, and customers. Before you physically build or change anything, you want to simulate: *"If I put this load here, and generate this much power there, what voltages will I see across the network? Where will the cables be overloaded? Where will energy be lost?"*

**Pandapower is that simulator.**

It is a Python library that lets you:
- **Draw** an electrical network in code (buses, wires, transformers, generators, loads)
- **Run calculations** to find what voltages, currents, and power flows result from that network
- **Automate** those calculations over time (e.g., simulate a full 24-hour day, every 15 minutes)
- **Optimize** the network (find the cheapest generator dispatch that still keeps voltages safe)
- **Visualize** the results on maps or diagrams

It was built by German university researchers (Kassel / Fraunhofer IEE) and is used by utilities, researchers, and engineers worldwide for distribution and transmission grid studies.

**The CGG fork** uses pandapower as a computation engine for internal power system studies. It adds compartmentalized web tooling on top so analysts can run standard analyses without writing Python.

---

## 2. What the App Actually Does

Pandapower is a **library, not a standalone application**. You import it in Python and call its functions. The typical workflow is:

```
Define Network → Load Data → Run Analysis → Read Results → Act or Visualize
```

### Core analysis types supported

| Analysis | Function | What it answers |
|---|---|---|
| **AC Power Flow (Load Flow)** | `pp.runpp()` | Voltages, currents, losses at every bus and line |
| **DC Power Flow** | `pp.rundcpp()` | Fast linear approximation, angles only |
| **Optimal Power Flow** | `pp.runopp()` | Cheapest generation dispatch within constraints |
| **Short Circuit Analysis** | `pp.calc_sc()` | Fault currents for protection design |
| **State Estimation** | `pp.estimate()` | Best-guess network state from measurements |
| **Time-Series Simulation** | `pp.timeseries.run_timeseries()` | Sequential load flow over time steps |
| **3-Phase Asymmetric Flow** | `pp.runpp_3ph()` | Unbalanced LV distribution analysis |

**Power Flow (Load Flow) is by far the most common.** It is the foundation for all other analyses.

---

## 3. Component Inventory

### 3.1 Top-Level Package Structure

```
pandapower/                     ← main Python package
│
├── __init__.py                 ← exports all public API functions
├── run.py                      ← runpp(), rundcpp(), runopp() — the main entry points
├── powerflow.py                ← core AC power flow engine
├── create.py                   ← create_bus(), create_line(), create_load(), etc.
├── auxiliary.py / _aux_*.py    ← helper utilities, logging, network prep
├── diagnostic.py               ← network validation and sanity checks
├── file_io.py / sql_io.py      ← save/load networks (JSON, Excel, pickle, SQL)
│
├── control/                    ← controller framework (tap changers, PQ control)
├── estimation/                 ← state estimation
├── grid_equivalents/           ← network reduction
├── networks/                   ← built-in test networks (IEEE, CIGRE, Kerber, etc.)
├── optimal_powerflow/          ← OPF problem formulation and solver calls
├── plotting/                   ← matplotlib, plotly, geo-plotting, HTML export
├── shortcircuit/               ← IEC short circuit analysis
├── timeseries/                 ← time-series simulation engine
├── toolbox.py                  ← grid utilities (scaling, element selection, etc.)
├── topology/                   ← graph connectivity (NetworkX)
└── runpm/                      ← PowerModels.jl integration (Julia backend)
```

### 3.2 Network Element DataFrames

A pandapower network (`net`) is a **collection of pandas DataFrames**. Every element type has its own DataFrame.

#### Nodes

| DataFrame | What it stores |
|---|---|
| `net.bus` | All electrical nodes (buses) — voltage level, name, in-service flag |
| `net.res_bus` | Power flow results at each bus: `vm_pu`, `va_degree`, `p_mw`, `q_mvar` |

#### Lines & Branches

| DataFrame | What it stores |
|---|---|
| `net.line` | Overhead lines and cables — impedance, capacity, length, connected buses |
| `net.trafo` | Two-winding transformers — turns ratio, tap settings, impedance |
| `net.trafo3w` | Three-winding transformers |
| `net.impedance` | Generic series impedance elements |
| `net.dcline` | HVDC lines with loss model |
| `net.switch` | Breakers and disconnectors for topology modification |

#### Generation

| DataFrame | What it stores |
|---|---|
| `net.ext_grid` | External grid connection — the slack bus (absorbs imbalance) |
| `net.gen` | Synchronous generators — active power set-point, voltage set-point |
| `net.sgen` | Static generators — PV panels, wind turbines (fixed PQ injection) |
| `net.storage` | Battery storage — charge/discharge with SOC tracking |

#### Loads & Consumption

| DataFrame | What it stores |
|---|---|
| `net.load` | Constant power loads — the consumers |
| `net.motor` | Induction motors (load with dynamic behavior) |
| `net.asymmetric_load` | Three-phase unbalanced loads |

#### Compensation & Control

| DataFrame | What it stores |
|---|---|
| `net.shunt` | Fixed shunt capacitors / reactors |
| `net.svc` | Static VAR Compensators |
| `net.statcom` | STATCOM devices |
| `net.ward` | Ward equivalent (simplified external network) |
| `net.xward` | Extended Ward equivalent |

#### Measurement & Metadata

| DataFrame | What it stores |
|---|---|
| `net.measurement` | Voltage/power/current measurements (for state estimation) |
| `net.std_types` | Library of standard cable/transformer types |

---

## 4. Detailed Module Explanations

### 4.1 `create.py` — Building the Network

Every network element has a dedicated `create_*()` function. These functions:
1. Validate the parameters
2. Append a new row to the appropriate DataFrame
3. Return the index of the new element

```python
import pandapower as pp

net = pp.create_empty_network()

# Create two buses at 10 kV
b1 = pp.create_bus(net, vn_kv=10, name="Substation")
b2 = pp.create_bus(net, vn_kv=10, name="Load Bus")

# Connect them with a cable using a standard type from the library
pp.create_line(net, from_bus=b1, to_bus=b2, length_km=5,
               std_type="NAYY 4x50 SE")

# Connect external grid at bus 1 (this becomes the slack bus)
pp.create_ext_grid(net, bus=b1, vm_pu=1.0)

# Add a load at bus 2
pp.create_load(net, bus=b2, p_mw=1.5, q_mvar=0.5)
```

The network is now fully defined in memory as DataFrames.

---

### 4.2 `run.py` + `powerflow.py` — The Calculation Engine

**`runpp(net, ...)`** is the main power flow entry point. It:

1. Validates the network (check for isolated buses, missing data, etc.)
2. Builds the **Y-bus admittance matrix** from the network topology
3. Classifies buses as: Slack (1), PV (generator with voltage control), PQ (loads)
4. Selects the solver algorithm
5. Iterates until the **power mismatch** falls below tolerance
6. Writes results back to `net.res_*` DataFrames

**Solver algorithms:**

| Algorithm | Flag | Notes |
|---|---|---|
| Newton-Raphson | `'nr'` | Default. Accurate, quadratic convergence |
| Fast-Decoupled BX | `'fdbx'` | Faster, less accurate for high R/X ratio networks |
| Fast-Decoupled XB | `'fdxb'` | Alternative FD variant |
| Gauss-Seidel | `'gs'` | Slow, rarely used |
| DC approximation | `'dc'` | Linear, angles only — very fast |
| Forward-Backward Sweep | `'bfsw'` | Best for radial LV networks |

**Key parameters of `runpp()`:**

```python
pp.runpp(
    net,
    algorithm='nr',          # solver choice
    init='auto',             # initialization: 'flat', 'dc', 'results', 'auto'
    max_iteration=10,        # iteration limit
    tolerance_mva=1e-8,      # convergence threshold (MVA mismatch)
    numba=True,              # use Numba JIT for speed
    recycle=None,            # dict of recyclable elements for repeated runs
    trafo_model='t',         # transformer model: 't' or 'pi'
    check_connectivity=True  # validate topology before solving
)
```

**After a successful run:**
- `net.converged` = `True`
- `net.res_bus` contains voltage at every bus
- `net.res_line` contains current and power flow on every line
- `net.res_trafo`, `net.res_gen`, `net.res_load` contain element results

---

### 4.3 `timeseries/` — Time-Series Power Flow

The time-series module runs sequential power flows across multiple time steps. Each "time step" can represent a quarter-hour interval, an hour, a day — whatever resolution you need.

**Architecture:**

```
DataSource (CSV / DataFrame)
    ↓
ConstControl / DFData controllers — update net.load[p_mw], net.sgen[p_mw], etc.
    ↓
run_timeseries(net, time_steps) — loops over time steps
    ↓  (each iteration)
    runpp(net)
    OutputWriter — logs res_bus, res_line, etc.
    ↓
OutputWriter.output — pandas DataFrames of results per time step
```

**Key classes:**
- `DFData` — wraps a pandas DataFrame as a data source (rows = time steps)
- `ConstControl` — a controller that reads from a DFData and writes to a network element's parameter column
- `OutputWriter` — logs selected result tables at each time step

**Minimal example:**

```python
import pandapower as pp
import pandapower.timeseries as ts
import pandapower.control as ctrl
import pandas as pd
import numpy as np

# Build network
net = pp.create_empty_network()
b1 = pp.create_bus(net, vn_kv=0.4)
b2 = pp.create_bus(net, vn_kv=0.4)
pp.create_line(net, b1, b2, 0.1, std_type="NAYY 4x50 SE")
pp.create_ext_grid(net, b1)
lid = pp.create_load(net, b2, p_mw=0.0, q_mvar=0.0)

# 24 hourly load values
load_profile = pd.DataFrame({"load_p": np.sin(np.linspace(0, 2*np.pi, 24)) * 0.5 + 0.5})

# Create controller: at each step, write load_profile["load_p"] → net.load.p_mw[lid]
ds = ts.DFData(load_profile)
ctrl.ConstControl(net, element='load', variable='p_mw',
                  element_index=lid, data_source=ds, profile_name='load_p')

# Set up output writer
ow = ts.OutputWriter(net, output_path=None, output_file_type=".json")
ow.log_variable('res_bus', 'vm_pu')
ow.log_variable('res_line', 'loading_percent')

# Run
ts.run_timeseries(net, time_steps=range(24))

# Results
print(ow.output['res_bus.vm_pu'])
```

---

### 4.4 `control/` — Controllers

Controllers are objects that execute logic **before each power flow** in a time-series run. They can:
- Read a time-series profile and update element parameters
- Implement on-load tap changer (OLTC) logic
- Implement Q(V) droop control for DER inverters
- Implement constant power factor control

Controllers follow a lifecycle:
1. `initialize_control(net)` — called once at the start
2. `time_step(net, t)` — called at the start of each time step
3. `control_step(net)` — called within the convergence loop
4. `finalize_control(net)` — called once at the end

---

### 4.5 `networks/` — Built-In Test Networks

Pandapower ships example networks for testing and learning:

```python
# CIGRE medium voltage test case
net = pp.networks.create_cigre_network_mv()

# Simple 3-bus test network
net = pp.networks.example_simple()

# Kerber low-voltage feeder
net = pp.networks.kb_extrem_landnetz_freileitung()
```

These are useful for understanding the library without building a network from scratch.

---

### 4.6 `plotting/` — Visualization

**Static matplotlib plots:**
```python
import pandapower.plotting as plot
plot.simple_plot(net)
```

**Interactive plotly:**
```python
import pandapower.plotting.plotly as pplotly
pplotly.simple_plotly(net)
```

**Geographic plotting** (requires geodata in `net.bus_geodata`):
```python
plot.geo_data_to_geodata(net)
plot.simple_plot(net, plot_line_switches=True)
```

---

### 4.7 `shortcircuit/` — Fault Analysis

```python
import pandapower.shortcircuit as sc

sc.calc_sc(net,
           fault='3ph',        # three-phase bolted fault
           ip=True,            # calculate peak short circuit current
           ith=True,           # calculate thermal short circuit current
           branch_results=True)

print(net.res_bus_sc)   # fault currents at each bus
print(net.res_line_sc)  # contributions through each line
```

---

### 4.8 `file_io.py` — Saving and Loading Networks

```python
# Save to JSON (recommended — human readable, version-safe)
pp.to_json(net, "my_network.json")
net2 = pp.from_json("my_network.json")

# Save to pickle (fast, binary)
pp.to_pickle(net, "my_network.pkl")

# Save to Excel (for sharing with non-Python users)
pp.to_excel(net, "my_network.xlsx")
```

---

### 4.9 `diagnostic.py` — Network Validation

```python
pp.diagnostic(net, report_style='detailed')
```

This checks for:
- Isolated buses (electrically disconnected from the network)
- Buses with no loads or generators
- Overloaded lines or transformers
- Invalid impedance values
- Transformer ratio mismatches
- Incorrect bus voltage levels

Run this **before** `runpp()` when debugging convergence issues.

---

## 5. Experimentation & Testing

### 5.1 Install and Verify

```bash
# Inside the CGG fork directory
pip install -e ".[plotting,fileio]"

# Verify
python -c "import pandapower; print(pandapower.__version__)"
```

### 5.2 Run the Tutorial Notebooks

The `tutorials/` directory contains Jupyter notebooks covering all major features. Run them in order:

```bash
cd tutorials/
jupyter notebook
```

Key tutorials:
- `powerflow.ipynb` — basic AC power flow
- `create_simple_network.ipynb` — network construction walkthrough
- `timeseries.ipynb` — time-series simulation
- `cigre_network.ipynb` — using a standard test case
- `shortcircuit.ipynb` — fault analysis

### 5.3 Testing Understanding

**Exercise 1: Observe voltage drop**
1. Create a radial feeder with 5 buses chained in series
2. Add increasing loads at each bus
3. Run power flow
4. Plot `net.res_bus.vm_pu` — you should see voltage drop along the feeder

**Exercise 2: Overload a line**
1. Use `example_simple()` network
2. Gradually increase a load until a line reaches 100% loading
3. Observe `net.res_line.loading_percent`

**Exercise 3: Time-series voltage sag**
1. Build a simple network with a solar generator (sgen)
2. Create a 24-hour irradiance profile (high noon, zero at night)
3. Run time-series
4. Plot bus voltage over time — observe the midday voltage rise

**Exercise 4: Tap changer effect**
1. Build a transformer network
2. Change `net.trafo.tap_pos` from 0 to ±2
3. Re-run power flow each time
4. Observe how voltage on the LV side changes

### 5.4 Creating Mods — Where to Touch the Code

| What you want to mod | Where to look |
|---|---|
| Add a new element type | `create.py` (add function), `__init__.py` (export), element result tables |
| Change solver defaults | `run.py` → `runpp()` default arguments |
| Add a new controller | `control/controller/` — subclass `BasicCtrl` |
| Change output writer behavior | `timeseries/output_writer.py` |
| Add a built-in network | `networks/` — add a new Python file, import in `networks/__init__.py` |
| Change file format | `file_io.py` |
| Custom visualization | `plotting/` — add a new plot function |

### 5.5 Implementing Mods — Process

1. **Branch from CGG fork** — never modify `develop` or `master` directly
2. **Write a test** in `pandapower/test/` for the new behavior
3. **Implement** the change
4. **Run existing tests** to confirm nothing is broken:
   ```bash
   pytest pandapower/test/ -v -x
   ```
5. **Document** your change in `Lesson Learned Notes.md`

---

## 6. Simple Power Flow Workflow

The most common single-shot analysis: **run AC power flow on a network and read results.**

```
┌─────────────────────────────────────────────────────┐
│  STEP 1: Define or load the network                 │
│  net = pp.from_json("my_network.json")              │
│  — OR —                                             │
│  net = pp.networks.example_simple()                 │
└────────────────────┬────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────┐
│  STEP 2: (Optional) Modify parameters               │
│  net.load.at[0, 'p_mw'] = 5.0                      │
│  net.trafo.at[0, 'tap_pos'] = 2                    │
└────────────────────┬────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────┐
│  STEP 3: Run power flow                             │
│  pp.runpp(net, algorithm='nr',                      │
│           tolerance_mva=1e-8)                       │
└────────────────────┬────────────────────────────────┘
                     │
          ┌──────────▼──────────┐
          │ net.converged?      │
          │  True   │   False   │
          └────┬────┘    └──────┴─ debug with pp.diagnostic(net)
               │
┌──────────────▼──────────────────────────────────────┐
│  STEP 4: Read results                               │
│  net.res_bus    → voltages at every bus             │
│  net.res_line   → current, loading%, power flow     │
│  net.res_trafo  → transformer loading and losses    │
│  net.res_gen    → generator active/reactive output  │
│  net.res_load   → load consumption                  │
└──────────────┬──────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────┐
│  STEP 5: Visualize / export                         │
│  pp.plotting.simple_plot(net)                       │
│  net.res_bus.to_csv("results.csv")                  │
└─────────────────────────────────────────────────────┘
```

**Minimum viable power flow in 10 lines:**

```python
import pandapower as pp

net = pp.create_empty_network()
b1 = pp.create_bus(net, vn_kv=11, name="Grid")
b2 = pp.create_bus(net, vn_kv=11, name="Load A")
b3 = pp.create_bus(net, vn_kv=11, name="Load B")
pp.create_ext_grid(net, b1, vm_pu=1.0)
pp.create_line(net, b1, b2, length_km=2, std_type="NAYY 4x50 SE")
pp.create_line(net, b2, b3, length_km=1, std_type="NAYY 4x50 SE")
pp.create_load(net, b2, p_mw=0.8, q_mvar=0.3)
pp.create_load(net, b3, p_mw=0.4, q_mvar=0.1)

pp.runpp(net)
print(net.res_bus[['vm_pu', 'va_degree']])
print(net.res_line[['p_from_mw', 'loading_percent']])
```

---

## 7. Automated Time-Series Power Flow

This is the **most important workflow for CGG studies.** It simulates a network over a time horizon (e.g., one day at 15-minute resolution = 96 time steps).

**Use cases:**
- Daily load curve studies (residential, commercial, industrial)
- PV hosting capacity (how much solar can the feeder absorb?)
- Voltage violation detection over time
- Line overload frequency analysis
- Battery dispatch studies

**Full annotated workflow:**

```python
import pandapower as pp
import pandapower.timeseries as ts
import pandapower.control as ctrl
import pandas as pd
import numpy as np

# ─── 1. BUILD THE NETWORK ───────────────────────────────────────────
net = pp.create_empty_network()
b_grid = pp.create_bus(net, vn_kv=11, name="Grid")
b_load = pp.create_bus(net, vn_kv=11, name="Load Bus")
b_solar= pp.create_bus(net, vn_kv=11, name="Solar Bus")

pp.create_ext_grid(net, b_grid, vm_pu=1.02)
pp.create_line(net, b_grid, b_load, 2.0, std_type="NAYY 4x150 SE")
pp.create_line(net, b_load, b_solar, 0.5, std_type="NAYY 4x150 SE")

# Element indices we'll drive with profiles
load_id  = pp.create_load(net, b_load,  p_mw=0.0, q_mvar=0.0)
sgen_id  = pp.create_sgen(net, b_solar, p_mw=0.0, q_mvar=0.0)

# ─── 2. CREATE TIME-SERIES PROFILES (96 steps = 15-min intervals) ──
n_steps = 96
hours   = np.linspace(0, 24, n_steps, endpoint=False)

# Load: peak at 7am and 7pm, low overnight
load_profile = 0.2 + 0.6 * (
    np.exp(-((hours - 7)**2)/4) + np.exp(-((hours - 19)**2)/4)
)

# Solar: bell curve centered on noon (zero at night)
solar_profile = np.clip(
    0.8 * np.exp(-((hours - 12)**2)/8), 0, None
)

profiles = pd.DataFrame({
    "load_p":  load_profile,
    "solar_p": solar_profile,
}, index=range(n_steps))

# ─── 3. ATTACH CONTROLLERS ──────────────────────────────────────────
ds_load  = ts.DFData(profiles)
ds_solar = ts.DFData(profiles)

ctrl.ConstControl(net, element='load', variable='p_mw',
                  element_index=load_id,
                  data_source=ds_load, profile_name='load_p')

ctrl.ConstControl(net, element='sgen', variable='p_mw',
                  element_index=sgen_id,
                  data_source=ds_solar, profile_name='solar_p')

# ─── 4. SET UP OUTPUT WRITER ────────────────────────────────────────
ow = ts.OutputWriter(net, output_path=None, output_file_type=".json")
ow.log_variable('res_bus',  'vm_pu')
ow.log_variable('res_line', 'loading_percent')
ow.log_variable('res_line', 'pl_mw')           # active losses

# ─── 5. RUN ─────────────────────────────────────────────────────────
ts.run_timeseries(net, time_steps=range(n_steps),
                  continue_on_divergence=False,
                  verbose=True)

# ─── 6. ANALYZE RESULTS ─────────────────────────────────────────────
voltages = ow.output['res_bus.vm_pu']     # shape: (96, n_buses)
loadings = ow.output['res_line.loading_percent']

print("Minimum voltage:", voltages.min().min(), "pu")
print("Maximum line loading:", loadings.max().max(), "%")

# Export
voltages.to_csv("voltage_results.csv")
loadings.to_csv("line_loading_results.csv")
```

**Result interpretation:**
- Voltages below **0.95 pu** → under-voltage violation (too much load, not enough generation)
- Voltages above **1.05 pu** → over-voltage violation (too much solar, not enough load)
- Line loading above **100%** → thermal overload (cable is carrying too much current)

---

## 8. Related Documents

- **[Experimental Power Flow (Load Flow) Analysis PRD.md](./Experimental%20Power%20Flow%20%28Load%20Flow%29%20Analysis%20PRD.md)** — Product Requirements Document for the compartmentalized GitHub Pages web UI that enables Power Flow analysis without writing Python code.

- **[Lesson Learned Notes.md](./Lesson%20Learned%20Notes.md)** — Accumulated discoveries, gotchas, and working patterns from modding and experimenting with pandapower in the CGG fork.

- **[architecture.md](./architecture.md)** — Internal architecture notes from the upstream project.

- **[GUI_PRD.md](./GUI_PRD.md)** — Existing GUI PRD in the CGG fork.

---

*Last updated: 2026-03-25 | CGG Fork — not intended for upstream merge*
