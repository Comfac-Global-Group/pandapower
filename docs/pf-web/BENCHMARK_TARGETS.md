# Pandapower vs ETAP — Benchmark Targets & Validation Framework

> **Status:** Awaiting ETAP reference data from Cornersteel  
> **Owner:** CGG IT — Power Systems Tools Development  
> **Goal:** Validate that `comfac-pandapower` web app produces results within industry-acceptable tolerance of ETAP

---

## 1. Philosophy

We do not expect **bit-for-bit identical** results between ETAP and pandapower. Different solvers, different numerical libraries, and different modeling assumptions will produce small differences.

**What matters:** The differences must be small enough that engineering decisions (breaker sizing, cable selection, transformer rating) are **identical** regardless of which tool produced the numbers.

---

## 2. Tolerance Criteria

### Tier 1 — Must Match (Critical for Safety)

| Parameter | ETAP Value | Pandapower Target | Acceptable Tolerance | Why It Matters |
|-----------|-----------|-------------------|---------------------|----------------|
| Bus voltage magnitude (pu) | V_ETAP | V_PP | **±0.5%** or ±0.005 pu | Voltage compliance, equipment rating |
| Line loading (%) | L_ETAP | L_PP | **±5%** | Thermal overload detection |
| Transformer loading (%) | T_ETAP | T_PP | **±5%** | Transformer life, cooling |
| 3-phase fault current (kA) | I_ETAP | I_PP | **±5%** | Breaker breaking capacity |
| Total system losses (kW) | P_ETAP | P_PP | **±10%** | Energy cost estimation |

### Tier 2 — Should Match (Engineering Confidence)

| Parameter | Acceptable Tolerance | Notes |
|-----------|---------------------|-------|
| Voltage angle (degrees) | ±0.5° | Less critical for distribution networks |
| Reactive power flow (MVAr) | ±10% | Affects capacitor bank sizing |
| Line current (kA) | ±5% | Used for cable ampacity checks |
| Convergence iterations | ±3 iterations | Different solver algorithms |

### Tier 3 — Nice to Match (Reporting Consistency)

| Parameter | Acceptable Tolerance | Notes |
|-----------|---------------------|-------|
| Fault MVA | ±5% | Used in preliminary studies |
| X/R ratio | ±10% | Affects DC offset calculation |
| Motor starting voltage dip | ±10% | If motor modeling is added later |

---

## 3. Validation Test Matrix

Once Cornersteel provides ETAP data, we will run the **exact same network** in both tools and compare:

### Test 1: Simple Radial Feeder (Baseline)
```
Grid (11 kV) → Line 2 km → Bus A → Line 1 km → Bus B
                                    ↓ Load 1 MW
```
**ETAP inputs needed:** Bus voltages, line impedances, load P/Q  
**Pandapower run:** Snapshot load flow  
**Compare:** Bus voltages at A and B, line loading, losses

### Test 2: Transformer + LV Network
```
Grid (11 kV) → Transformer 0.25 MVA → Main Panel (0.4 kV) → Floor panels
```
**ETAP inputs needed:** Transformer %Z, tap, LV line lengths, load distribution  
**Pandapower run:** Snapshot + tap changer sweep (-2 to +2 taps)  
**Compare:** LV bus voltage, transformer loading, voltage sensitivity to tap

### Test 3: Solar Rooftop Hosting Capacity
```
Grid → Transformer → Bus with Solar SGen + Building Load
```
**ETAP inputs needed:** Solar generation profile, load profile (if time-series available)  
**Pandapower run:** Snapshot at noon (max solar), time-series if profile available  
**Compare:** Voltage rise at solar bus, reverse power flow, transformer loading at peak solar

### Test 4: Short-Circuit at Main Bus
```
Same network as Test 1 → 3ph bolted fault at Bus A
```
**ETAP inputs needed:** Fault current at each bus, peak current, fault MVA  
**Pandapower run:** `calc_sc(fault='3ph', ip=True, ith=True)`  
**Compare:** Fault current magnitude at each bus, highest fault location

### Test 5: Commercial Building Time-Series (If Available)
```
Office building → 24-hour load profile → HVAC + lighting + equipment
```
**ETAP inputs needed:** Hourly load values, transformer loading over time, voltage min/max  
**Pandapower run:** Time-series with 15-min or 1-hour steps  
**Compare:** Min/max voltage over day, peak transformer loading, violation count

---

## 4. How Differences Will Be Documented

For every parameter compared, we will record:

```markdown
| Bus/Element | ETAP Value | Pandapower Value | Absolute Diff | % Diff | Status |
|-------------|-----------|------------------|---------------|--------|--------|
| Bus A (vm_pu) | 0.9785 | 0.9792 | +0.0007 | +0.07% | ✅ PASS |
| Line 1 (loading%) | 87.3% | 91.5% | +4.2% | +4.8% | ⚠️ MARGINAL |
```

**Status definitions:**
- ✅ **PASS** — Within Tier 1 tolerance
- ⚠️ **MARGINAL** — Within Tier 2 tolerance, needs investigation
- ❌ **FAIL** — Outside tolerance, bug or modeling difference must be resolved

---

## 5. Known Sources of Discrepancy

Before declaring a FAIL, we will check these known differences:

| Source | ETAP Behavior | Pandapower Behavior | Typical Impact |
|--------|--------------|---------------------|----------------|
| **Transformer model** | Detailed saturable model | Standard pi-model | Small (<1%) at normal load |
| **Line charging** | Optional | Included by default | Negligible for short LV lines |
| **Load model** | Constant Z/I/P mix | Constant PQ by default | Can affect voltage drop 2-5% |
| **Solver tolerance** | User-configurable | 1e-8 MVA default | Converges to same solution |
| **Base MVA** | Typically 100 MVA | 1 MVA (internal) | Does not affect pu results |
| **Motor modeling** | Detailed induction motor | Simplified or static load | Significant during starting |

**Action:** If a discrepancy is found, we will first verify that modeling assumptions match before declaring a tool bug.

---

## 6. Action Plan

| Step | Owner | Due Date | Status |
|------|-------|----------|--------|
| 1. Request ETAP data from Cornersteel | CGG IT | 2026-05-09 | ✅ Sent |
| 2. Receive ETAP sample reports | Cornersteel | 2026-05-23 | ⏳ Pending |
| 3. Rebuild ETAP networks in Pandapower | CGG IT | 2026-05-30 | 🔴 Blocked |
| 4. Run comparison matrix | CGG IT | 2026-06-06 | 🔴 Blocked |
| 5. Document discrepancies & fixes | CGG IT | 2026-06-13 | 🔴 Blocked |
| 6. Issue validation certificate | CGG IT + Engineering | 2026-06-20 | 🔴 Blocked |
| 7. Approve for field pilot | Engineering Manager | 2026-06-27 | 🔴 Blocked |

---

## 7. Target Statement

> **By June 20, 2026, the CGG PowerFlow Web app shall demonstrate that for all Cornersteel reference networks, its load flow and short-circuit results match ETAP within Tier 1 tolerances (±0.5% voltage, ±5% loading, ±5% fault current).**

Only after this validation is complete will the app be approved for use on live client projects.

---

*Document version: 1.0 | Awaiting Cornersteel ETAP data to proceed*
