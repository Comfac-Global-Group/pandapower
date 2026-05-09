/**
 * CGG PowerFlow Web — Network Templates (FDR-001)
 * Pre-built, realistic, always-converging network scenarios for field engineers.
 */

const NETWORK_TEMPLATES = {
  "simple-feeder": {
    name: "Simple Feeder",
    description: "3-bus radial feeder — substation → load → load. Quick voltage drop check.",
    icon: "⚡",
    buses: [
      { name: "Grid Substation", vn_kv: 11, in_service: true },
      { name: "Bus A — Residential", vn_kv: 11, in_service: true },
      { name: "Bus B — Commercial", vn_kv: 11, in_service: true }
    ],
    ext_grid: { bus_idx: 0, vm_pu: 1.02, min_vm_pu: 0.95, max_vm_pu: 1.05 },
    lines: [
      { from_bus: 0, to_bus: 1, length_km: 2.0, std_type: "NAYY 4x150 SE", in_service: true },
      { from_bus: 1, to_bus: 2, length_km: 1.0, std_type: "NAYY 4x150 SE", in_service: true }
    ],
    loads: [
      { bus_idx: 1, p_mw: 1.0, q_mvar: 0.3, name: "Load A", in_service: true },
      { bus_idx: 2, p_mw: 0.5, q_mvar: 0.1, name: "Load B", in_service: true }
    ],
    sgens: [],
    trafos: [],
    mode: "single"
  },

  "building-riser": {
    name: "Building Riser",
    description: "Transformer → main panel → floor panels. High-rise load distribution.",
    icon: "🏢",
    buses: [
      { name: "Grid Incomer", vn_kv: 11, in_service: true },
      { name: "Main Panel (0.4kV)", vn_kv: 0.4, in_service: true },
      { name: "Floor 1 Panel", vn_kv: 0.4, in_service: true },
      { name: "Floor 2 Panel", vn_kv: 0.4, in_service: true },
      { name: "Floor 3 Panel", vn_kv: 0.4, in_service: true },
      { name: "Floor 4 Panel", vn_kv: 0.4, in_service: true }
    ],
    ext_grid: { bus_idx: 0, vm_pu: 1.02, min_vm_pu: 0.95, max_vm_pu: 1.05 },
    lines: [
      { from_bus: 1, to_bus: 2, length_km: 0.05, std_type: "NAYY 4x150 SE", in_service: true },
      { from_bus: 2, to_bus: 3, length_km: 0.05, std_type: "NAYY 4x150 SE", in_service: true },
      { from_bus: 3, to_bus: 4, length_km: 0.05, std_type: "NAYY 4x150 SE", in_service: true },
      { from_bus: 4, to_bus: 5, length_km: 0.05, std_type: "NAYY 4x150 SE", in_service: true }
    ],
    loads: [
      { bus_idx: 2, p_mw: 0.08, q_mvar: 0.02, name: "Floor 1 Load", in_service: true },
      { bus_idx: 3, p_mw: 0.08, q_mvar: 0.02, name: "Floor 2 Load", in_service: true },
      { bus_idx: 4, p_mw: 0.08, q_mvar: 0.02, name: "Floor 3 Load", in_service: true },
      { bus_idx: 5, p_mw: 0.08, q_mvar: 0.02, name: "Floor 4 Load", in_service: true }
    ],
    sgens: [],
    trafos: [
      { hv_bus: 0, lv_bus: 1, std_type: "0.25 MVA 11/0.4 kV", tap_pos: 0, in_service: true }
    ],
    mode: "single"
  },

  "solar-rooftop": {
    name: "Solar Rooftop",
    description: "Grid → transformer → rooftop solar + building loads. Hosting capacity study.",
    icon: "☀️",
    buses: [
      { name: "Grid Substation", vn_kv: 11, in_service: true },
      { name: "Main LV Panel", vn_kv: 0.4, in_service: true },
      { name: "Solar Inverters", vn_kv: 0.4, in_service: true },
      { name: "Building Loads", vn_kv: 0.4, in_service: true }
    ],
    ext_grid: { bus_idx: 0, vm_pu: 1.02, min_vm_pu: 0.95, max_vm_pu: 1.05 },
    lines: [
      { from_bus: 1, to_bus: 2, length_km: 0.1, std_type: "NAYY 4x150 SE", in_service: true },
      { from_bus: 1, to_bus: 3, length_km: 0.1, std_type: "NAYY 4x150 SE", in_service: true }
    ],
    loads: [
      { bus_idx: 3, p_mw: 0.15, q_mvar: 0.05, name: "Building Load", in_service: true }
    ],
    sgens: [
      { bus_idx: 2, p_mw: 0.1, q_mvar: 0.0, name: "Rooftop Solar", in_service: true }
    ],
    trafos: [
      { hv_bus: 0, lv_bus: 1, std_type: "0.25 MVA 11/0.4 kV", tap_pos: 0, in_service: true }
    ],
    mode: "single"
  },

  "dual-transformer": {
    name: "Dual Transformer",
    description: "Two transformers with tie breaker. N-1 contingency check.",
    icon: "🔀",
    buses: [
      { name: "Grid Substation", vn_kv: 11, in_service: true },
      { name: "Transformer 1 LV", vn_kv: 0.4, in_service: true },
      { name: "Transformer 2 LV", vn_kv: 0.4, in_service: true },
      { name: "Common Load Bus", vn_kv: 0.4, in_service: true }
    ],
    ext_grid: { bus_idx: 0, vm_pu: 1.02, min_vm_pu: 0.95, max_vm_pu: 1.05 },
    lines: [
      { from_bus: 1, to_bus: 3, length_km: 0.05, std_type: "NAYY 4x150 SE", in_service: true },
      { from_bus: 2, to_bus: 3, length_km: 0.05, std_type: "NAYY 4x150 SE", in_service: true }
    ],
    loads: [
      { bus_idx: 3, p_mw: 0.12, q_mvar: 0.04, name: "Common Load", in_service: true }
    ],
    sgens: [],
    trafos: [
      { hv_bus: 0, lv_bus: 1, std_type: "0.25 MVA 11/0.4 kV", tap_pos: 0, in_service: true },
      { hv_bus: 0, lv_bus: 2, std_type: "0.25 MVA 11/0.4 kV", tap_pos: 0, in_service: true }
    ],
    mode: "single"
  },

  "street-lighting": {
    name: "Street Lighting",
    description: "Long LV line with multiple light poles. Voltage profile check.",
    icon: "💡",
    buses: [
      { name: "Grid Supply", vn_kv: 0.4, in_service: true },
      { name: "Pole 1", vn_kv: 0.4, in_service: true },
      { name: "Pole 2", vn_kv: 0.4, in_service: true },
      { name: "Pole 3", vn_kv: 0.4, in_service: true },
      { name: "Pole 4", vn_kv: 0.4, in_service: true },
      { name: "Pole 5", vn_kv: 0.4, in_service: true },
      { name: "Pole 6", vn_kv: 0.4, in_service: true }
    ],
    ext_grid: { bus_idx: 0, vm_pu: 1.02, min_vm_pu: 0.95, max_vm_pu: 1.05 },
    lines: [
      { from_bus: 0, to_bus: 1, length_km: 0.05, std_type: "NAYY 4x50 SE", in_service: true },
      { from_bus: 1, to_bus: 2, length_km: 0.05, std_type: "NAYY 4x50 SE", in_service: true },
      { from_bus: 2, to_bus: 3, length_km: 0.05, std_type: "NAYY 4x50 SE", in_service: true },
      { from_bus: 3, to_bus: 4, length_km: 0.05, std_type: "NAYY 4x50 SE", in_service: true },
      { from_bus: 4, to_bus: 5, length_km: 0.05, std_type: "NAYY 4x50 SE", in_service: true },
      { from_bus: 5, to_bus: 6, length_km: 0.05, std_type: "NAYY 4x50 SE", in_service: true }
    ],
    loads: [
      { bus_idx: 1, p_mw: 0.001, q_mvar: 0.0003, name: "Light 1", in_service: true },
      { bus_idx: 2, p_mw: 0.001, q_mvar: 0.0003, name: "Light 2", in_service: true },
      { bus_idx: 3, p_mw: 0.001, q_mvar: 0.0003, name: "Light 3", in_service: true },
      { bus_idx: 4, p_mw: 0.001, q_mvar: 0.0003, name: "Light 4", in_service: true },
      { bus_idx: 5, p_mw: 0.001, q_mvar: 0.0003, name: "Light 5", in_service: true },
      { bus_idx: 6, p_mw: 0.001, q_mvar: 0.0003, name: "Light 6", in_service: true }
    ],
    sgens: [],
    trafos: [],
    mode: "single"
  }
};

// Available standard line types for dropdowns
const STD_LINE_TYPES = [
  "NAYY 4x50 SE",
  "NAYY 4x150 SE",
  "NAYY 4x185 SE",
  "NA2XS2Y 1x185 RM/25 12/20 kV",
  "N2XS(FL)2Y 1x300 RM/35 64/110 kV",
  "149-AL1/24-ST1A 10.0"
];

// Available standard transformer types for dropdowns
const STD_TRAFO_TYPES = [
  "0.25 MVA 11/0.4 kV",
  "0.63 MVA 11/0.4 kV",
  "1.6 MVA 11/0.4 kV",
  "6.3 MVA 33/11 kV"
];
