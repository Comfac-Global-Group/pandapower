# Request for ETAP Sample Reports & Benchmark Data

> **To:** Cornersteel Engineering / Electrical Design Team  
> **From:** Comfac Global Group IT — Power Systems Tools Development  
> **Date:** 2026-05-09  
> **Re:** ETAP Reference Data for Pandapower Validation & Benchmarking

---

## Purpose

CGG IT is developing an **internal web-based power systems analysis tool** (`comfac-pandapower`) built on the open-source `pandapower` Python library. Before field deployment, we must validate that our tool produces results **within acceptable tolerance of ETAP** — the industry-standard software already in use at Cornersteel.

This document requests sample ETAP outputs for benchmarking.

---

## What We Need

### 1. Sample ETAP Project Files (or Reports)

Please provide **3 representative studies** that cover typical Cornersteel project types:

| # | Study Type | Example Scenario | Priority |
|---|-----------|------------------|----------|
| 1 | **Load Flow (LF)** | 11 kV substation feeding a commercial building or industrial plant | **Critical** |
| 2 | **Short-Circuit (SC)** | Same network as #1, 3-phase bolted fault at main bus | **Critical** |
| 3 | **Time-Series / Load Profile** | 24-hour load flow with variable load (if available in your ETAP version) | High |

### 2. Required Outputs Per Study

For each study, we need the following **tabular data** (screenshots OK, CSV/Excel preferred):

#### A. Load Flow Results
- Bus voltage magnitude (pu) for every bus
- Bus voltage angle (degrees) for every bus
- Active & reactive power injection at each bus (P, Q in MW/MVAr)
- Line loading percentage for every cable/line
- Transformer loading percentage
- Total system losses (kW)
- Convergence iteration count

#### B. Short-Circuit Results
- 3-phase symmetrical fault current (kA) at each bus
- Peak fault current (ip) if calculated
- Fault MVA at each bus
- Line contribution to fault current
- X/R ratio at faulted bus

#### C. Network Input Data
- Single-line diagram (PDF or image)
- Bus list with nominal voltages
- Line/cable list with lengths, types, impedances
- Transformer ratings (kVA, %Z, tap settings)
- Load ratings (kW, kVAr, power factor)
- Generator/solar ratings if present

---

## Why This Matters

| Concern | How ETAP Data Helps |
|---------|-------------------|
| **Accuracy validation** | Confirm pandapower results match ETAP within ±1% for voltage, ±5% for loading |
| **Engineer confidence** | Field staff will only trust the new tool if it matches the software they already know |
| **Safety compliance** | Breaker sizing, cable ratings, and protection settings must be consistent |
| **Client reporting** | CGG reports must use consistent numbers whether generated from ETAP or the new tool |

---

## Format for Submission

**Preferred:**
```
cornersteel-etap-benchmark/
├── 01_load_flow_commercial/
│   ├── etap_report.pdf
│   ├── bus_results.xlsx or .csv
│   ├── line_results.xlsx or .csv
│   ├── single_line_diagram.pdf
│   └── network_input.xlsx
├── 02_short_circuit_commercial/
│   └── ...
└── 03_time_series_industrial/
    └── ...
```

**Acceptable:** Screenshots of ETAP result windows, handwritten data sheets, or emailed Excel files.

**Deadline:** Please provide within **2 weeks** (by 2026-05-23) so we can complete validation before field pilot testing.

---

## Confidentiality

All submitted data will be:
- Stored in the private `cgg/comfac-pandapower` repository on citfj
- Accessible only to CGG IT and approved engineering staff
- Used solely for internal tool validation
- **NOT** shared upstream to the open-source pandapower project

If any project data is client-sensitive, please:
1. Anonymize bus names (e.g., "Client Substation" → "Substation A")
2. Remove GPS coordinates or exact addresses
3. Scale load values by a constant factor if desired

---

## Questions?

Contact: CGG IT Team via Forgejo (`cgg/comfac-pandapower`) or internal email.

---

*Thank you for supporting this initiative. Consistent, validated tools make all of us more effective in the field.*

— CGG IT / Power Systems Tools Development
