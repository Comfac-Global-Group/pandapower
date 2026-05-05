# Pandapower Web GUI — Product Requirements Document

> Incremental functional requirements for building a web-based GUI for pandapower.
> Milestones are ordered from most commonly used features to specialized ones.
> Each milestone is self-contained and delivers user value.

---

## Guiding Principles

1. **Incremental delivery** — each milestone ships a usable feature
2. **Most-used first** — power flow before OPF, OPF before short-circuit
3. **PDF reports at every stage** — each analysis milestone includes report generation
4. **pandapower as engine** — the GUI is a thin wrapper; all computation stays in pandapower
5. **JSON as transport** — `pp.to_json()` / `pp.from_json()` for all network data
6. **Plotly for visualization** — leverage pandapower's built-in Plotly integration

---

## Milestone 0: Project Foundation

### M0.1 — Backend Skeleton
- [ ] FastAPI (or Flask) project with CORS, health endpoint
- [ ] pandapower installed as dependency
- [ ] Session management: one `pandapowerNet` per session (in-memory to start)
- [ ] `POST /api/network` — create empty network, return session ID
- [ ] `GET /api/network` — return full network as JSON (`pp.to_json`)
- [ ] `DELETE /api/network` — clear session

### M0.2 — Frontend Skeleton
- [ ] React (or Vue/Svelte) SPA with router
- [ ] Basic layout: sidebar navigation, main content area, status bar
- [ ] API client module wrapping all backend calls
- [ ] Toast/notification system for errors and success messages

### M0.3 — Network Import/Export
- [ ] `POST /api/network/import` — accept JSON file upload → `pp.from_json()`
- [ ] `GET /api/network/export?format=json` — download as JSON
- [ ] `GET /api/network/export?format=xlsx` — download as Excel
- [ ] Frontend: Import dialog with drag-and-drop
- [ ] Frontend: Export buttons (JSON, Excel)

### M0.4 — Built-In Example Networks
- [ ] `GET /api/networks/examples` — list available test networks
- [ ] `POST /api/networks/examples/{name}` — load a test network (e.g., `case_ieee30`, `mv_oberrhein`, `simple_four_bus_system`)
- [ ] Frontend: "Load Example" picker in new-network flow

---

## Milestone 1: Network Editor (CRUD)

### M1.1 — Bus Management
- [ ] Table view of all buses (`net.bus` DataFrame)
- [ ] Create bus: form with `vn_kv`, `name`, `type`, `zone`, `geodata`
- [ ] Edit bus parameters inline or via modal
- [ ] Delete bus (with validation — warn if connected elements exist)
- [ ] Bulk operations: select multiple, delete, change zone

### M1.2 — Line Management
- [ ] Table view of all lines (`net.line`)
- [ ] Create line: select `from_bus`, `to_bus`, `length_km`, `std_type` (dropdown from `net.std_types["line"]`)
- [ ] Create line from parameters: `r_ohm_per_km`, `x_ohm_per_km`, `c_nf_per_km`, `max_i_ka`
- [ ] Edit/delete lines
- [ ] Show standard type library with search/filter

### M1.3 — Transformer Management
- [ ] Table view of 2-winding transformers (`net.trafo`)
- [ ] Create trafo: `hv_bus`, `lv_bus`, `std_type` (dropdown from `net.std_types["trafo"]`)
- [ ] Create from parameters: `sn_mva`, `vn_hv_kv`, `vn_lv_kv`, `vk_percent`, `vkr_percent`, etc.
- [ ] Tap changer configuration: `tap_pos`, `tap_min`, `tap_max`, `tap_step_percent`
- [ ] 3-winding transformers (`net.trafo3w`) as advanced option

### M1.4 — Load & Generation
- [ ] Create/edit/delete loads: `bus`, `p_mw`, `q_mvar`, `type` (wye/delta), `const_z/i/p_percent`
- [ ] Create/edit/delete generators: `bus`, `p_mw`, `vm_pu`, `min_p_mw`, `max_p_mw`
- [ ] Create/edit/delete static generators (sgen): `bus`, `p_mw`, `q_mvar`, `type`
- [ ] Create/edit/delete external grids: `bus`, `vm_pu`, `va_degree`
- [ ] Table views for each element type

### M1.5 — Switches & Shunts
- [ ] Switch management: create between bus-bus or bus-element, toggle open/closed
- [ ] Shunt management: `bus`, `p_mw`, `q_mvar`, `vn_kv`
- [ ] Storage management: `bus`, `p_mw`, `max_e_mwh`, `soc_percent`
- [ ] Impedance management: `from_bus`, `to_bus`, `rft_pu`, `xft_pu`

### M1.6 — Network Diagram (View Only)
- [ ] `GET /api/plot/network` — return Plotly figure JSON using `pp.plotting.plotly.simple_plotly()`
- [ ] Render Plotly figure in frontend
- [ ] Auto-generate geodata if missing (`pp.plotting.create_generic_coordinates()`)
- [ ] Color buses by voltage level
- [ ] Hover tooltips showing element details
- [ ] Zoom, pan, select

---

## Milestone 2: Power Flow Analysis (AC/DC)

> **This is the #1 most-used pandapower feature.** Everything else builds on this.

### M2.1 — Run Power Flow
- [ ] `POST /api/analysis/powerflow` with options:
  - `algorithm`: "nr" (default), "bfsw", "gs", "fdbx", "fdxb"
  - `init`: "auto", "flat", "dc", "results"
  - `max_iteration`, `tolerance_mva`
  - `calculate_voltage_angles`: true/false/"auto"
  - `enforce_q_lims`: true/false
  - `trafo_model`: "t" / "pi"
  - `voltage_depend_loads`: true/false
  - `distributed_slack`: true/false
- [ ] Return convergence status, iteration count, elapsed time
- [ ] Frontend: "Run Power Flow" button with collapsible options panel

### M2.2 — Results Dashboard
- [ ] Bus results table: `vm_pu`, `va_degree`, `p_mw`, `q_mvar` — color-code voltage violations
- [ ] Line results table: `loading_percent`, `i_from_ka`, `i_to_ka`, `pl_mw`, `ql_mvar` — highlight overloads
- [ ] Transformer results table: `loading_percent`, `pl_mw`, `ql_mvar`
- [ ] Generator results table: `p_mw`, `q_mvar`, `vm_pu`
- [ ] Summary cards: total generation, total load, total losses, max loading, min/max voltage

### M2.3 — Results Visualization
- [ ] Network diagram colored by bus voltage magnitude (heatmap)
- [ ] Network diagram colored by line/trafo loading percentage
- [ ] Use `pp.plotting.plotly.pf_res_plotly()` or custom Plotly traces
- [ ] Legend showing color scale
- [ ] Toggle between voltage view and loading view

### M2.4 — DC Power Flow
- [ ] `POST /api/analysis/dcpowerflow` — calls `pp.rundcpp()`
- [ ] Same results dashboard as AC but with DC-specific fields
- [ ] Frontend toggle: AC / DC power flow

### M2.5 — Power Flow PDF Report
- [ ] `GET /api/report/powerflow` — generate PDF
- [ ] Report contents:
  - Network summary (# buses, lines, trafos, gens, loads)
  - Solver settings used
  - Convergence info
  - Bus voltage table (sorted by violation severity)
  - Line loading table (sorted by loading %)
  - Transformer loading table
  - Total generation vs total load vs losses
  - Network diagram screenshot (server-side Plotly image export)
  - Voltage profile chart (vm_pu vs bus index)
  - Loading bar chart (top 10 most loaded branches)
- [ ] PDF library: WeasyPrint or ReportLab on backend

---

## Milestone 3: Optimal Power Flow (OPF)

### M3.1 — Cost Function Setup
- [ ] UI to define polynomial costs per generator/load: `cp0_eur`, `cp1_eur_per_mw`, `cp2_eur_per_mw2`
- [ ] UI to define piecewise-linear costs
- [ ] Set `controllable=True` on generators/loads/storage
- [ ] Set min/max P and Q limits on controllable elements
- [ ] Set voltage limits on buses: `min_vm_pu`, `max_vm_pu`
- [ ] Set loading limits on lines/trafos: `max_loading_percent`

### M3.2 — Run OPF
- [ ] `POST /api/analysis/opf` — calls `pp.runopp()`
- [ ] `POST /api/analysis/dcopf` — calls `pp.rundcopp()`
- [ ] Options: `init`, `verbose`, `delta`
- [ ] Return objective value, convergence, dispatch schedule

### M3.3 — OPF Results Dashboard
- [ ] Optimal dispatch table: generator P/Q setpoints
- [ ] Cost breakdown per generator
- [ ] Binding constraints highlighted (voltage limits, loading limits, P/Q limits)
- [ ] Comparison view: base case vs OPF dispatch

### M3.4 — OPF PDF Report
- [ ] Network & cost setup summary
- [ ] Optimal dispatch schedule
- [ ] Total cost
- [ ] Binding constraints
- [ ] Voltage/loading compliance tables
- [ ] Generation dispatch bar chart

---

## Milestone 4: Short-Circuit Analysis

### M4.1 — Run Short-Circuit
- [ ] `POST /api/analysis/shortcircuit` with options:
  - `fault`: "3ph", "2ph", "1ph"
  - `case`: "max", "min"
  - `ip`: true/false (aperiodic current)
  - `ith`: true/false (thermal equivalent)
  - `tk_s`: fault clearing time
  - `lv_tol_percent`: 6 or 10
  - `r_fault_ohm`, `x_fault_ohm`: fault impedance
  - `branch_results`: true/false
- [ ] Calls `pp.shortcircuit.calc_sc(net, ...)`

### M4.2 — Short-Circuit Results
- [ ] Bus SC table: `ikss_ka` (symmetrical), `ip_ka` (peak), `ith_ka` (thermal)
- [ ] Branch SC table (if branch_results=True): currents through lines/trafos
- [ ] Highlight buses exceeding equipment ratings
- [ ] Network diagram colored by SC current magnitude

### M4.3 — Short-Circuit PDF Report
- [ ] Fault type & case settings
- [ ] Bus short-circuit current table (sorted by magnitude)
- [ ] Branch currents (if calculated)
- [ ] Equipment rating comparison (SC current vs breaker rating)
- [ ] Network diagram with SC current overlay
- [ ] Bar chart: top 10 highest SC currents

---

## Milestone 5: Network Diagnostics & Topology

### M5.1 — Network Diagnostics
- [ ] `POST /api/diagnostic` — calls pandapower diagnostic functions
- [ ] Check for: isolated buses, duplicate lines, disconnected elements, missing impedance, impossible switch configs
- [ ] Return categorized issues with severity (error, warning, info)
- [ ] Frontend: diagnostic panel with expandable issue groups
- [ ] Quick-fix suggestions where possible

### M5.2 — Topology Analysis
- [ ] `GET /api/topology` — network graph analysis
- [ ] Connected components (islands)
- [ ] Unsupplied buses
- [ ] Stubs, bridges, articulation points
- [ ] Meshed vs radial classification
- [ ] Frontend: highlight topology features on network diagram

### M5.3 — Diagnostics PDF Report
- [ ] Issue summary by category
- [ ] Detailed issue list with element references
- [ ] Topology summary
- [ ] Connectivity diagram

---

## Milestone 6: State Estimation

### M6.1 — Measurement Management
- [ ] Create/edit/delete measurements: `meas_type` (v, p, q, i), `element_type`, `element`, `value`, `std_dev`
- [ ] Table view of all measurements
- [ ] Visual overlay: show measurement locations on network diagram

### M6.2 — Run State Estimation
- [ ] `POST /api/analysis/estimation` with options:
  - `algorithm`: "wls", "wls_with_zero_constraint", "irwls", "opt", "lp"
  - `init`: "flat", "results", "slack"
  - `tolerance`, `maximum_iterations`
  - `zero_injection`: handling of zero-injection buses
- [ ] Calls `pp.estimation.estimate(net, ...)`

### M6.3 — Estimation Results
- [ ] Estimated vs measured values comparison table
- [ ] Residual analysis (measurement residuals)
- [ ] Bad data detection indicators
- [ ] Estimated voltage profile overlay on network diagram

### M6.4 — State Estimation PDF Report
- [ ] Measurement summary
- [ ] Estimated state table
- [ ] Residual statistics
- [ ] Bad data flags
- [ ] Voltage profile comparison (estimated vs measured)

---

## Milestone 7: Time Series Simulation

### M7.1 — Time Series Data Setup
- [ ] Upload CSV/Excel time-varying profiles (load P/Q, generation P/Q per timestep)
- [ ] Map profiles to network elements (which profile → which load/generator)
- [ ] Preview profiles as time-series charts
- [ ] Built-in profile templates (daily load curve, solar generation curve)

### M7.2 — Run Time Series
- [ ] `POST /api/analysis/timeseries` with options:
  - `time_steps`: range or list
  - `continue_on_divergence`: true/false
  - `output_variables`: which results to record
- [ ] Progress indicator (WebSocket or SSE for long simulations)
- [ ] Cancel running simulation

### M7.3 — Time Series Results
- [ ] Time-series charts: voltage at selected buses over time
- [ ] Time-series charts: loading at selected branches over time
- [ ] Heatmap: all bus voltages over all timesteps
- [ ] Statistical summary: min, max, mean, std for each element
- [ ] Identify timesteps with violations

### M7.4 — Time Series PDF Report
- [ ] Simulation setup summary
- [ ] Key statistics table
- [ ] Voltage and loading time-series charts
- [ ] Violation summary (which timesteps, which elements)
- [ ] Daily/hourly aggregated tables

---

## Milestone 8: Contingency Analysis

### M8.1 — Contingency Definition
- [ ] Define contingency set: which lines/trafos/generators to trip
- [ ] N-1 auto-generation: all single-element outages
- [ ] Custom contingency lists
- [ ] Import/export contingency definitions

### M8.2 — Run Contingency Analysis
- [ ] `POST /api/analysis/contingency` — calls `pp.contingency.run_contingency()`
- [ ] Parallel execution for large contingency sets
- [ ] Progress indicator

### M8.3 — Contingency Results
- [ ] Table: each contingency case → worst voltage violation, worst loading
- [ ] Highlight critical contingencies (non-convergent or with violations)
- [ ] Drill-down: click a contingency to see full results
- [ ] Network diagram: overlay worst-case loading

### M8.4 — Contingency PDF Report
- [ ] Contingency set summary
- [ ] Critical contingencies table
- [ ] Per-contingency results (top N worst cases)
- [ ] Comparison charts: base case vs contingency loading
- [ ] Pass/fail summary

---

## Milestone 9: Advanced Features

### M9.1 — Controller Configuration
- [ ] List active controllers in network
- [ ] Configure tap changer controllers: target voltage, deadband, side
- [ ] Configure DER controllers: droop settings, reactive power modes
- [ ] Run power flow with controllers enabled (`run_control=True`)
- [ ] Show controller convergence info

### M9.2 — Protection Devices
- [ ] Fuse configuration and coordination
- [ ] Overcurrent relay settings
- [ ] Protection coordination diagrams (time-current curves)
- [ ] Protection PDF report

### M9.3 — Grid Equivalents
- [ ] Define internal/external zones
- [ ] Generate REI or Ward equivalents
- [ ] Compare full network vs equivalent results
- [ ] Export equivalent network

### M9.4 — Three-Phase Analysis
- [ ] Asymmetric load/generator creation
- [ ] Run 3-phase unbalanced power flow (`runpp_3ph`)
- [ ] Phase-specific results (A, B, C voltages/currents)
- [ ] Unbalance factor visualization

### M9.5 — FACTS Devices
- [ ] SVC, TCSC, SSC, VSC creation and configuration
- [ ] Results with FACTS devices in power flow
- [ ] FACTS device operating point visualization

---

## Milestone 10: Project Management & Collaboration

### M10.1 — Project Save/Load
- [ ] Save network + settings + results to project file
- [ ] Load project file to restore full state
- [ ] Auto-save / recovery
- [ ] Project metadata: name, description, author, date

### M10.2 — Scenario Comparison
- [ ] Save named scenarios (snapshots of network state)
- [ ] Compare two scenarios side-by-side
- [ ] Diff view: what changed between scenarios
- [ ] Comparison PDF report

### M10.3 — User Management (if multi-user)
- [ ] Authentication
- [ ] Project sharing / permissions
- [ ] Audit log of changes

---

## Milestone 11: Format Converters

### M11.1 — Import Formats
- [ ] MATPOWER `.m` files → `pp.converter.from_mpc()`
- [ ] PYPOWER case dicts → `pp.converter.from_ppc()`
- [ ] CIM/CGMES XML → `pp.converter.cim.from_cim()`
- [ ] PowerFactory `.dgs` → `pp.converter.powerfactory.from_pf()`
- [ ] UCTE `.uct` files → `pp.converter.ucte.from_ucte()`

### M11.2 — Export Formats
- [ ] MATPOWER format export
- [ ] PYPOWER format export
- [ ] CIM export (where supported)

---

## Report Generation Strategy

Every analysis milestone includes PDF report generation. The approach:

### Backend PDF Pipeline
```
Analysis Results (DataFrames)
    │
    ├─→ Jinja2 HTML template (styled tables, charts)
    │       │
    │       ├─→ Plotly server-side image export (kaleido)
    │       │
    │       └─→ WeasyPrint → PDF
    │
    └─→ Alternative: ReportLab for direct PDF generation
```

### Report Template Structure
Every report shares a common structure:
1. **Header**: Report title, date, network name, pandapower version
2. **Network Summary**: Element counts, voltage levels, total generation/load
3. **Analysis Settings**: Parameters used
4. **Results Tables**: Sorted by severity/importance, color-coded
5. **Charts/Diagrams**: Network plots, bar charts, profiles
6. **Footer**: Page numbers, generation timestamp

### PDF Generation Priority
| Priority | Report | Milestone |
|----------|--------|-----------|
| 1 | Power Flow Report | M2.5 |
| 2 | Short-Circuit Report | M4.3 |
| 3 | OPF Report | M3.4 |
| 4 | Diagnostics Report | M5.3 |
| 5 | Time Series Report | M7.4 |
| 6 | Contingency Report | M8.4 |
| 7 | State Estimation Report | M6.4 |
| 8 | Protection Report | M9.2 |
| 9 | Scenario Comparison Report | M10.2 |

---

## Non-Functional Requirements

### Performance
- Power flow on networks up to 10,000 buses should complete in < 5 seconds
- PDF report generation should complete in < 30 seconds
- Time series: show progress for simulations > 100 timesteps
- Use `recycle` option for repeated power flows

### Usability
- Responsive layout (desktop primary, tablet secondary)
- Keyboard shortcuts for common actions (Ctrl+R = run power flow)
- Undo/redo for element creation/modification
- Contextual help linking to pandapower documentation

### Reliability
- Graceful handling of non-convergent power flows (show diagnostic info)
- Input validation before sending to backend
- Auto-save network state every 5 minutes
- Session recovery after browser refresh

### Security
- Input sanitization on all API endpoints
- File upload size limits and type validation
- No arbitrary code execution from user input
- Rate limiting on analysis endpoints
