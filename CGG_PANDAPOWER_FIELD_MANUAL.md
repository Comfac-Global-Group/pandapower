# Comfac-PandaPower Field Engineer Manual

> **For:** Electricians, Maintenance Engineers, and Field Technicians  
> **Purpose:** A portable power-system analysis tool that runs on phones and tablets — no Python coding required.  
> **Version:** 1.0  
> **Date:** 2026-05-09  
> **Org:** Comfac Global Group (CGG) — Comfac IT Forgejo (citfj)

---

## Table of Contents

1. [What Is This? (In Plain English)](#1-what-is-this-in-plain-english)
2. [Who Uses This & Why](#2-who-uses-this--why)
3. [What It Can Do Today (Library Capabilities)](#3-what-it-can-do-today-library-capabilities)
4. [How You Will Use It (The Portable App)](#4-how-you-will-use-it-the-portable-app)
5. [UI/UX Analysis — Best Way to Make It Portable](#5-uiux-analysis--best-way-to-make-it-portable)
6. [Feature Design Requirements (FDR) — Electrician & Maintenance Edition](#6-feature-design-requirements-fdr--electrician--maintenance-edition)
7. [Recommended Technical Architecture](#7-recommended-technical-architecture)
8. [Implementation Roadmap](#8-implementation-roadmap)
9. [Quick Start — Common Field Scenarios](#9-quick-start--common-field-scenarios)
10. [Safety & Compliance Notes](#10-safety--compliance-notes)
11. [Appendix A: Glossary](#appendix-a-glossary)
12. [Appendix B: Result Interpretation Cheat Sheet](#appendix-b-result-interpretation-cheat-sheet)

---

## 1. What Is This? (In Plain English)

**PandaPower** is an open-source electrical network simulator originally built by German university researchers. It answers questions like:

- *"If we add this new aircon load, will the cable overheat?"*
- *"What is the voltage at the end of this long feeder?"*
- *"If this transformer fails, what happens to the rest of the network?"*

The **CGG fork** (`comfac-pandapower`) is our private, compartmentalized copy. We are building a **web-based user interface** on top of it so that **field engineers can run these calculations on a phone or tablet** without writing Python code or installing anything complex.

Think of it as a **"pocket power engineer"** — a calculator for medium-voltage (MV) and low-voltage (LV) distribution networks.

---

## 2. Who Uses This & Why

### Primary Users

| Role | Typical Task | What They Need |
|------|-------------|----------------|
| **Electrician (LV/MV)** | Install new loads, troubleshoot voltage complaints | Quick voltage-drop check, cable sizing, breaker coordination |
| **Maintenance Engineer** | Plan shutdowns, assess transformer health, replace cables | Loading analysis, contingency check, thermal rating verification |
| **Field Supervisor** | Approve temporary connections, validate contractor designs | Pass/fail reports, PDF export, violation summaries |
| **Project Engineer** | Preliminary design of new feeders or building expansions | Load flow study, scenario comparison, time-series simulation |

### Key Requirement: PORTABILITY

These users are **not at a desk**. They are:
- In a substation with no Wi-Fi
- On a rooftop reviewing solar connections
- In a basement checking panelboards
- Driving between job sites

**The app must work on a smartphone or tablet, offline, with no backend server.**

---

## 3. What It Can Do Today (Library Capabilities)

The underlying Python library supports the following analyses. **Not all will be exposed in the mobile app** — we prioritize the ones field staff use most.

### Tier 1 — Must-Have for Field App

| Analysis | What It Tells You | Field Use Case |
|----------|-------------------|----------------|
| **AC Power Flow (Load Flow)** | Voltage at every point, current in every cable, losses | *"Will voltage stay within ±5% after adding this load?"* |
| **DC Power Flow** | Fast linear approximation of power angles | *"Quick sanity check on a large network"* |
| **Short-Circuit (IEC 60909)** | Fault current at every bus | *"Is this breaker rated high enough?"* |

### Tier 2 — Useful for Maintenance Planning

| Analysis | What It Tells You | Field Use Case |
|----------|-------------------|----------------|
| **Time-Series Power Flow** | Voltage & loading over 24 hours | *"Will transformer overheat during peak hours?"* |
| **Contingency (N-1)** | What happens if one line/transformer fails | *"Can the network survive this cable outage?"* |
| **State Estimation** | Best-guess network state from meter readings | *"My meters disagree — what is the real state?"* |

### Tier 3 — Specialist / Office Use

| Analysis | What It Tells You | Field Use Case |
|----------|-------------------|----------------|
| **Optimal Power Flow (OPF)** | Cheapest way to run generators | *Office economic dispatch studies* |
| **Protection Coordination** | Fuse & relay settings | *Protection engineer desk work* |
| **Three-Phase Unbalanced Flow** | Phase-by-phase LV analysis | *Rural single-phase feeder studies* |

### Standard Component Library

Pandapower includes pre-built catalogs of real-world cables and transformers:

**Common Cables (pre-loaded)**
- `NAYY 4x50 SE` — light LV distribution
- `NAYY 4x150 SE` — medium LV distribution (default)
- `NAYY 4x185 SE` — heavy LV distribution
- `NA2XS2Y 1x185 RM/25 12/20 kV` — MV cable

**Common Transformers (pre-loaded)**
- `0.25 MVA 11/0.4 kV` — small substation
- `0.63 MVA 11/0.4 kV` — medium substation
- `1.6 MVA 11/0.4 kV` — large substation

---

## 4. How You Will Use It (The Portable App)

### The Vision: "Open → Tap → Run → Read"

```
1. Open the app on your phone (installed as PWA)
2. Tap to build the network:
   - Add buses (substation, load points)
   - Add cables between buses
   - Add loads and generators
3. Tap "Run Analysis"
4. Read color-coded results:
   - 🟢 Green = OK
   - 🟡 Amber = Watch
   - 🔴 Red = Problem
5. Export PDF report if needed
```

### Two Modes

| Mode | When to Use | Output |
|------|-------------|--------|
| **Single Snapshot** | Quick check — "Right now, is this OK?" | Instant voltage & loading tables |
| **Time-Series** | Planning — "Over the day, what happens?" | 24-hour charts, violation counts |

### Offline-First Design

- The app is a **Progressive Web App (PWA)** — install it once, use it forever offline.
- All calculation runs **inside the browser** using Pyodide (Python in WebAssembly).
- No server, no cloud, no subscription.
- Save/load network files as JSON (share via email, WhatsApp, or local storage).

---

## 5. UI/UX Analysis — Best Way to Make It Portable

### 5.1 Why Standard Web Apps Fail in the Field

Traditional web apps need:
- A backend server (needs internet, needs maintenance)
- A database (more infrastructure)
- A DevOps team (not available on-site)

**Field reality:** No internet, no IT support, dusty hands, bright sunlight.

### 5.2 Recommended Approach: Pyodide PWA

**Pyodide** = Python compiled to WebAssembly, running entirely in the browser.

```
┌─────────────────────────────────────────────┐
│  Phone / Tablet (Chrome, Safari, Edge)      │
│                                             │
│  ┌──────────────┐  ┌─────────────────────┐ │
│  │ HTML/CSS/JS  │  │ Pyodide (Python VM) │ │
│  │ UI Layer     │  │ pandapower + numpy  │ │
│  │              │  │ pandas + scipy      │ │
│  └──────────────┘  └─────────────────────┘ │
│         │                    │              │
│         └────── JS ↔ Python ─┘              │
│                                             │
│  • Works offline after first load           │
│  • No backend server                        │
│  • Installable to home screen               │
│  • JSON save/load                           │
└─────────────────────────────────────────────┘
```

**Trade-offs:**

| Pros | Cons | Mitigation |
|------|------|------------|
| Zero infrastructure | ~50MB first download | Cache aggressively; show progress bar |
| 100% offline | Browser memory limits (~1-2GB) | Cap networks to ~100 buses |
| Runs on any device | Slower than native Python | Use Numba where possible; accept 5-10s for complex runs |
| Easy to update (one file) | No native file system access | Use browser download/upload for JSON/Excel |

### 5.3 Alternative: Tauri Desktop App (Backup Plan)

If the Pyodide download is too large for slow Philippine mobile data:

- Package a lightweight Python runtime + pandapower inside a **Tauri** app
- Single executable for Windows/Linux/macOS
- ~200MB installer, but no runtime download
- Can be sideloaded on field laptops

### 5.4 Mobile UI Patterns

#### Screen Real Estate (Phone: 360–420px wide)

```
┌─────────────────────────┐
│ ≡  CGG PowerFlow   ⚙️   │  ← Header + settings
├─────────────────────────┤
│ [Snapshot] [Time-Series]│  ← Mode toggle
├─────────────────────────┤
│ NETWORK                 │
│ ┌─────────────────────┐ │
│ │ Bus 1  ▼ 11kV  🗑️  │ │  ← Collapsible cards
│ │ Bus 2  ▼ 11kV  🗑️  │ │
│ │ + Add Bus           │ │
│ └─────────────────────┘ │
│ LINES                   │
│ ┌─────────────────────┐ │
│ │ Line 1: B1→B2  2km │ │
│ │ + Add Line          │ │
│ └─────────────────────┘ │
│ LOADS                   │
│ ...                     │
│                         │
│ [   ▶ RUN ANALYSIS   ]  │  ← Big thumb-friendly button
├─────────────────────────┤
│ RESULTS                 │
│ 🟢 Voltage OK           │
│ 🟡 Line 2 at 87%        │
│ 🔴 Bus 3 undervoltage   │
│ [View Details] [PDF]    │
└─────────────────────────┘
```

#### Critical Mobile UX Decisions

| Decision | Rationale |
|----------|-----------|
| **Big touch targets** (min 48×48dp) | Gloves, dust, shaky hands |
| **Bottom navigation** | Thumb-reachable |
| **High-contrast colors** | Outdoor sunlight visibility |
| **Offline indicator** | Green dot = cached, red dot = need first download |
| **Swipe gestures** | Swipe left on card = delete; swipe right = duplicate |
| **Voice notes** | Attach audio memo to each bus/line (e.g., "Transformer making noise") |
| **QR code scanning** | Scan equipment nameplate → auto-fill rated values |

### 5.5 Color Coding (Universal Language)

| Color | Meaning | Voltage | Loading | Fault Current |
|-------|---------|---------|---------|---------------|
| 🟢 **Green** | OK / Safe | 0.95–1.05 pu | < 70% | Within breaker rating |
| 🟡 **Amber** | Caution / Watch | 0.90–0.95 or 1.05–1.10 pu | 70–90% | Near breaker limit |
| 🔴 **Red** | Danger / Violation | < 0.90 or > 1.10 pu | > 90% or > 100% | Exceeds breaker rating |
| ⚫ **Gray** | Out of service | Disconnected | Not applicable | Not applicable |

---

## 6. Feature Design Requirements (FDR) — Electrician & Maintenance Edition

### 6.1 FDR-001: One-Tap Network Templates

**Requirement:** Pre-built network templates for common Comfac scenarios.

| Template Name | Description | Use Case |
|---------------|-------------|----------|
| **Simple Feeder** | 3-bus radial feeder (substation → load → load) | Basic voltage drop check |
| **Building Riser** | Transformer → main panel → sub-panels → floors | High-rise load check |
| **Solar Rooftop** | Grid → transformer → solar inverters → loads | Hosting capacity study |
| **Dual Transformer** | Two transformers with tie breaker | N-1 contingency check |
| **Street Lighting** | Long LV line with multiple light poles | Voltage profile check |

**Acceptance Criteria:**
- User selects template → all buses, lines, loads auto-populated with realistic defaults
- User only changes 2–3 values (load size, cable length) before running
- Always converges with default values

### 6.2 FDR-002: Equipment Nameplate Scanner

**Requirement:** Scan a QR code or barcode on a transformer, cable, or breaker to auto-fill parameters.

**Data captured:**
- Transformer: kVA, HV/LV voltage, impedance %, tap range
- Cable: type, length (from GPS if not on reel), ampacity
- Breaker: rated current, breaking capacity, trip curve

**Acceptance Criteria:**
- Camera opens in-app
- QR decode fills the form in < 2 seconds
- Manual override always available

### 6.3 FDR-003: Voice & Photo Annotations

**Requirement:** Attach media to any network element.

- **Photo:** Take picture of equipment nameplate, cable routing, or fault location
- **Voice:** 30-second audio note per element
- **Geotag:** GPS coordinates auto-attached to each bus

**Acceptance Criteria:**
- Media stored in JSON (Base64 for small images, path reference for large)
- Included in PDF report

### 6.4 FDR-004: Smart Defaults & Warnings

**Requirement:** The app guesses intelligently and warns before bad inputs.

| Input | Smart Default | Warning Trigger |
|-------|---------------|-----------------|
| Cable length | GPS distance between two bus locations | > 500 m for LV cable |
| Load power | Based on building type (dropdown: office, warehouse, retail) | > 80% of cable ampacity |
| Transformer | Smallest standard type that fits total load | Load > 90% of transformer kVA |
| Voltage level | 11 kV for MV, 0.4 kV for LV | Mixed voltage levels without transformer |

### 6.5 FDR-005: Pass/Fail Dashboard

**Requirement:** A single-screen summary that any supervisor can read in 5 seconds.

```
┌─────────────────────────────────────────┐
│  CGG POWER CHECK — Project XYZ          │
│  Date: 2026-05-09 | Engineer: J. Tan    │
├─────────────────────────────────────────┤
│                                         │
│   🟢 PASS     🟡 WATCH      🔴 FAIL     │
│   8 items     2 items       1 item      │
│                                         │
│  ── FAILURES ──                         │
│  🔴 Bus 5 (Panel B): 0.89 pu (undervolt)│
│     → Action: Upsize cable or add cap   │
│                                         │
│  ── WATCHES ──                          │
│  🟡 Line 3: 88% loading                 │
│  🟡 Transformer T1: 85% loading         │
│                                         │
│  [📄 Generate PDF Report]               │
│  [💾 Save Network JSON]                 │
│  [📤 Share via Email/WhatsApp]          │
│                                         │
└─────────────────────────────────────────┘
```

### 6.6 FDR-006: Offline PDF Report Generation

**Requirement:** Generate a professional PDF report entirely on-device.

**Report contents:**
1. Cover page (project name, date, engineer, location map)
2. Network diagram (auto-generated)
3. Executive summary (pass/fail counts)
4. Detailed results tables
5. Recommendations (auto-generated text)
6. Appendix: input data, equipment photos, voice transcript

**Acceptance Criteria:**
- PDF generated in < 10 seconds
- File size < 2 MB
- Readable on any phone PDF viewer

### 6.7 FDR-007: Time-Series "Daily Curve" Mode

**Requirement:** Simulate a full 24-hour day with pre-built load profiles.

**Pre-built profiles:**
- Office building (peak 9am–5pm)
- Warehouse (peak 8am–12pm, low overnight)
- Retail mall (peak 10am–9pm)
- Residential (peak 7am & 7pm)
- Solar generation (bell curve, zero at night)

**Output:**
- "X of 96 time steps had voltage violations"
- "Maximum transformer loading: 94% at 2:00 PM"
- "Recommended action: Upgrade transformer to 0.63 MVA"

### 6.8 FDR-008: Short-Circuit "Breaker Check"

**Requirement:** Quick breaker adequacy check.

**Input:** Breaker rated breaking current (from nameplate scan)
**Output:**
- 🟢 "Breaker OK — fault current 8.2 kA < rating 10 kA"
- 🔴 "Breaker UNDERSIZED — fault current 12.5 kA > rating 10 kA"

### 6.9 FDR-009: Multi-Language Support

**Requirement:** Toggle between English and Filipino (Taglish) for field staff.

| English | Taglish |
|---------|---------|
| Bus voltage | Boltahe ng bus |
| Line loading | Load ng kable |
| Overvoltage | Sobrang boltahe |
| Undervoltage | Kulang sa boltahe |
| Transformer overloaded | Sobrang load ang transformer |

### 6.10 FDR-010: Backup & Sync

**Requirement:** Projects sync to Comfac IT Forgejo when Wi-Fi is available.

- Auto-queue projects while offline
- Sync when connected to office Wi-Fi or mobile data
- Store on `citfj` private repo for audit trail

---

## 7. Recommended Technical Architecture

### 7.1 Phase 1: Pyodide PWA (Immediate — 2–4 weeks)

**Stack:**
```
Frontend:  Vanilla JS + Tailwind CSS + Chart.js
Python:    Pyodide (WASM) + micropip install pandapower
Deploy:    GitHub Pages OR local nginx on field laptop
Storage:   Browser IndexedDB + JSON download/upload
```

**Why this first:**
- Fastest to build
- Zero infrastructure
- Proves the concept
- Works on any device with a browser

**Limitations:**
- 50–80 MB first load
- ~100 bus practical limit
- No native file system

### 7.2 Phase 2: Tauri Desktop App (Month 2–3)

**Stack:**
```
Frontend:  React + Plotly.js
Backend:   Bundled Python (via PyOxidizer or embedded CPython)
Package:   Tauri (Rust-based, lightweight)
Deploy:    MSI/EXE/DMG installer from GitHub Releases
```

**Why this second:**
- No runtime download
- Full file system access
- Faster execution
- Can run larger networks (500+ buses)

### 7.3 Phase 3: Capacitor Hybrid App (Month 4–6)

**Stack:**
```
Frontend:  React (shared with Phase 2)
Native:    Capacitor (Android/iOS wrapper)
Backend:   Lightweight Python HTTP server inside the app
Deploy:    Google Play / Apple TestFlight (internal)
```

**Why this third:**
- True native app feel
- Push notifications
- Background sync to citfj
- Camera/QR integration is seamless

### 7.4 Data Flow

```
Field Engineer (Phone/Tablet)
        │
        ▼
┌─────────────────┐
│  PWA / Native   │
│  App UI         │
└────────┬────────┘
         │ JSON network definition
         ▼
┌─────────────────┐
│  Pyodide /      │
│  Python Runtime │
│  + pandapower   │
└────────┬────────┘
         │ Results DataFrame
         ▼
┌─────────────────┐
│  Charts, Tables │
│  PDF Generator  │
└────────┬────────┘
         │ PDF / JSON
         ▼
    [Email] [Save] [Sync to citfj]
```

---

## 8. Implementation Roadmap

### Sprint 1: MVP Single Power Flow (Weeks 1–2)
- [ ] Set up `docs/pf-web/` with Pyodide loader
- [ ] Build bus/line/load form with smart defaults
- [ ] Implement AC power flow execution
- [ ] Show color-coded results table
- [ ] Add voltage bar chart
- [ ] JSON save/load

### Sprint 2: Mobile Polish & Templates (Weeks 3–4)
- [ ] Responsive CSS for phones
- [ ] 5 network templates
- [ ] PWA manifest + service worker
- [ ] Offline indicator
- [ ] Touch-friendly buttons

### Sprint 3: Time-Series & PDF (Weeks 5–6)
- [ ] Time-series mode with pre-built profiles
- [ ] Violation counter
- [ ] PDF report generation (jsPDF)
- [ ] Photo attachment (camera API)

### Sprint 4: Short-Circuit & Breaker Check (Weeks 7–8)
- [ ] Short-circuit calculation
- [ ] Breaker adequacy check
- [ ] Nameplate parameter input
- [ ] Auto-recommendation text

### Sprint 5: Sync & Enterprise (Weeks 9–10)
- [ ] Citfj sync when online
- [ ] User authentication (Forgejo OAuth)
- [ ] Project history / audit log
- [ ] Admin dashboard for managers

### Sprint 6: Native Packaging (Months 3–4)
- [ ] Tauri desktop app
- [ ] Capacitor mobile app (internal testing)
- [ ] Performance optimization (numba, caching)

---

## 9. Quick Start — Common Field Scenarios

### Scenario A: "Will This Cable Handle the Load?"

**Situation:** Adding a 50 HP motor (≈ 37 kW) to an existing 11 kV feeder.

**Steps:**
1. Open app → select **Simple Feeder** template
2. Tap the load bus → change `p_mw` to `0.037` (37 kW)
3. Tap "Run Analysis"
4. Check line loading:
   - 🟢 < 70% → cable is fine
   - 🟡 70–90% → monitor temperature
   - 🔴 > 90% → upgrade cable size

### Scenario B: "Why Are the Lights Dim?"

**Situation:** Voltage complaint at the end of a long LV line.

**Steps:**
1. Open app → select **Street Lighting** template
2. Measure actual cable length with GPS or tape → enter in app
3. Run analysis
4. Check last bus voltage:
   - 🟢 > 0.95 pu → voltage is fine, look elsewhere
   - 🟡 0.90–0.95 pu → marginal, consider thicker cable
   - 🔴 < 0.90 pu → definite problem, upsize cable or add capacitor bank

### Scenario C: "Can We Add More Solar?"

**Situation:** Client wants to add 100 kW of rooftop solar.

**Steps:**
1. Open app → select **Solar Rooftop** template
2. Add `sgen` (static generator) at the solar bus → `p_mw = 0.1`
3. Run time-series with **Solar + Residential** profiles
4. Check violation summary:
   - If "0 violations" → hosting capacity OK
   - If "overvoltage at midday" → need grid reinforcement or curtailment

### Scenario D: "Is This Breaker Big Enough?"

**Situation:** Installing a new breaker, need to verify rating.

**Steps:**
1. Open app → build network or load existing
2. Switch to **Short-Circuit** mode
3. Enter breaker rating (e.g., 10 kA breaking capacity)
4. Run analysis
5. Read result:
   - 🟢 Fault current < breaker rating → safe
   - 🔴 Fault current > breaker rating → unsafe, upgrade breaker

---

## 10. Safety & Compliance Notes

⚠️ **This tool is for analysis and planning only. It does not replace qualified engineering judgment or compliance with local electrical codes (Philippine Electrical Code, IEC 60909, etc.).**

### Important Limitations

1. **Model accuracy** depends on input data quality. Garbage in, garbage out.
2. **Standard types** are generic. Always verify cable/transformer parameters against actual nameplates.
3. **Short-circuit results** assume bolted faults. Arc faults and high-impedance faults will produce lower currents.
4. **Time-series profiles** are approximate. Actual load behavior varies by building, weather, and occupancy.
5. **Software bugs** are possible. Always cross-check critical results with a second method or senior engineer.

### When to Call a Senior Engineer

- Fault current > 20 kA (may need specialized switchgear)
- Voltage violations that cannot be fixed by cable upsizing
- Networks with > 100 buses
- Protection coordination studies
- Harmonic analysis (not supported by pandapower)

---

## Appendix A: Glossary

| Term | Meaning | Filipino |
|------|---------|----------|
| **Bus** | A point in the electrical network (substation, panel, junction) | Bus, punto ng kuryente |
| **Line** | Cable or overhead line connecting two buses | Kable, linya |
| **Load** | Something that consumes power (motor, light, aircon) | Load, konsumo |
| **Generator** | Something that produces power (solar, grid, genset) | Generator, pinagmumulan |
| **Transformer** | Device that changes voltage level | Transformer, tagabago ng boltahe |
| **Power Flow** | Calculation that finds voltage and current everywhere | Load flow, pagkalkula ng kuryente |
| **Per-unit (pu)** | Voltage expressed as a ratio (1.0 = 100% of nominal) | Per-unit, ratio ng boltahe |
| **Loading %** | How full a cable/transformer is (100% = at maximum rating) | Porsyento ng load |
| **Slack bus** | The reference point where the grid connects | Slack bus, pinagmumulan ng grid |
| **Convergence** | Did the calculation find a valid answer? | Convergence, nakahanap ng sagot |

## Appendix B: Result Interpretation Cheat Sheet

### Voltage (per-unit)

| Value | Status | Likely Cause | Fix |
|-------|--------|--------------|-----|
| 1.00–1.02 | Perfect | — | — |
| 0.95–1.05 | OK | Normal operation | Monitor |
| 0.90–0.95 | Low | Too much load, long cable, weak transformer | Upsize cable, add capacitor, upgrade transformer |
| < 0.90 | Dangerous | Severe overload or fault condition | Immediate action required |
| 1.05–1.10 | High | Too much generation, light load | Add load, curtail solar, adjust transformer tap |
| > 1.10 | Dangerous | Severe overvoltage | Disconnect generation, check transformer settings |

### Line/Transformer Loading

| Value | Status | Likely Cause | Fix |
|-------|--------|--------------|-----|
| < 50% | Light | Overdesigned | Normal, efficient |
| 50–70% | Normal | Good design | None |
| 70–90% | Heavy | Approaching limit | Monitor temperature, plan upgrade |
| 90–100% | Critical | At thermal limit | Reduce load or upsize immediately |
| > 100% | Overload | Exceeded rating | Emergency — reduce load now |

### Short-Circuit Current

| Value | Status | Action |
|-------|--------|--------|
| < 50% of breaker rating | Very safe | None |
| 50–80% of breaker rating | Safe | None |
| 80–100% of breaker rating | Marginal | Consider upgrading at next maintenance |
| > 100% of breaker rating | Unsafe | Upgrade breaker or reduce fault level |

---

*Document maintained by Comfac Global Group IT.  
For technical questions, contact the CGG IT team via citfj (https://git.comfac-it.net/cgg).  
For pandapower upstream documentation, see https://www.pandapower.org/*
