/**
 * CGG PowerFlow Web — Main Application Logic
 * FDR-001: One-Tap Network Templates
 * FDR-006: Offline PDF Reports
 * FDR-007: Time-Series Daily Curve
 * CSV Import, Demo Data, Report Generation
 */

const app = {
  pyodide: null,
  pyodideReady: false,
  currentMode: 'snapshot',
  network: {
    buses: [], lines: [], loads: [], sgens: [], trafos: [],
    ext_grid: { bus_idx: 0, vm_pu: 1.02, min_vm_pu: 0.95, max_vm_pu: 1.05 }
  },
  tsProfiles: [], // { loadIdx: number, type: 'load'|'sgen', values: number[] }
  lastResult: null,

  // ─── Initialization ───
  async init() {
    this.renderTemplates();
    this.bindModeToggle();
    this.startPyodideLoader();
  },

  // ─── Pyodide Loader ───
  async startPyodideLoader() {
    const progressFill = document.getElementById('progress-fill');
    const statusText = document.getElementById('status-text');
    const statusDot = document.getElementById('status-dot');
    const loader = document.getElementById('loader');
    const runBtn = document.getElementById('run-btn');

    try {
      progressFill.style.width = '10%';
      this.pyodide = await loadPyodide();
      progressFill.style.width = '40%';

      statusText.textContent = 'Installing packages…';
      await this.pyodide.loadPackage(['numpy', 'pandas', 'scipy', 'networkx']);
      progressFill.style.width = '70%';

      statusText.textContent = 'Installing pandapower…';
      await this.pyodide.runPythonAsync(`import micropip; await micropip.install('pandapower')`);
      progressFill.style.width = '100%';

      this.pyodideReady = true;
      statusText.textContent = 'Ready';
      statusDot.classList.add('ready');
      runBtn.disabled = false;
      setTimeout(() => loader.classList.add('hidden'), 500);
    } catch (err) {
      statusText.textContent = 'Load failed — reload page';
      console.error(err);
      alert('Failed to load Python runtime. Please check connection and reload.');
    }
  },

  // ─── Mode Toggle ───
  bindModeToggle() {
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentMode = btn.dataset.mode;
        document.getElementById('ts-panel').classList.toggle('hidden', this.currentMode !== 'timeseries');
      });
    });
  },

  // ─── Templates ───
  renderTemplates() {
    const grid = document.getElementById('template-grid');
    grid.innerHTML = '';
    Object.entries(NETWORK_TEMPLATES).forEach(([key, tpl]) => {
      const card = document.createElement('div');
      card.className = 'template-card';
      card.dataset.key = key;
      card.innerHTML = `<div class="template-icon">${tpl.icon}</div><div class="template-name">${tpl.name}</div><div class="template-desc">${tpl.description}</div>`;
      card.addEventListener('click', () => this.loadTemplate(key));
      grid.appendChild(card);
    });
  },

  loadTemplate(key) {
    const tpl = NETWORK_TEMPLATES[key];
    if (!tpl) return;
    document.querySelectorAll('.template-card').forEach(c => c.classList.remove('selected'));
    document.querySelector(`.template-card[data-key="${key}"]`)?.classList.add('selected');
    this.network = JSON.parse(JSON.stringify({
      buses: tpl.buses, lines: tpl.lines, loads: tpl.loads,
      sgens: tpl.sgens, trafos: tpl.trafos, ext_grid: tpl.ext_grid
    }));
    this.tsProfiles = [];
    this.renderAll();
    this.hideResults();
    document.querySelector('.section-header:nth-of-type(2)').scrollIntoView({ behavior: 'smooth' });
  },

  // ─── Demo Data ───
  loadDemo(type) {
    const demos = {
      'residential-solar': {
        network: {
          buses: [
            { name: "Grid Substation", vn_kv: 11, in_service: true },
            { name: "Main LV Panel", vn_kv: 0.4, in_service: true },
            { name: "House A", vn_kv: 0.4, in_service: true },
            { name: "House B", vn_kv: 0.4, in_service: true },
            { name: "Solar Inverter", vn_kv: 0.4, in_service: true }
          ],
          ext_grid: { bus_idx: 0, vm_pu: 1.02, min_vm_pu: 0.95, max_vm_pu: 1.05 },
          lines: [
            { from_bus: 1, to_bus: 2, length_km: 0.08, std_type: "NAYY 4x50 SE", in_service: true },
            { from_bus: 1, to_bus: 3, length_km: 0.08, std_type: "NAYY 4x50 SE", in_service: true },
            { from_bus: 1, to_bus: 4, length_km: 0.05, std_type: "NAYY 4x50 SE", in_service: true }
          ],
          loads: [
            { bus_idx: 2, p_mw: 0.008, q_mvar: 0.002, name: "House A Load", in_service: true },
            { bus_idx: 3, p_mw: 0.012, q_mvar: 0.003, name: "House B Load", in_service: true }
          ],
          sgens: [
            { bus_idx: 4, p_mw: 0.015, q_mvar: 0.0, name: "Rooftop Solar", in_service: true }
          ],
          trafos: [
            { hv_bus: 0, lv_bus: 1, std_type: "0.25 MVA 11/0.4 kV", tap_pos: 0, in_service: true }
          ]
        },
        profiles: [
          { elementType: 'load', elementIndex: 0, variable: 'p_mw', values: this.getResidentialLoadProfile() },
          { elementType: 'load', elementIndex: 1, variable: 'p_mw', values: this.getResidentialLoadProfile().map(v => v * 1.2) },
          { elementType: 'sgen', elementIndex: 0, variable: 'p_mw', values: this.getSolarProfile() }
        ]
      },
      'commercial-peak': {
        network: {
          buses: [
            { name: "Grid", vn_kv: 11, in_service: true },
            { name: "Main Panel", vn_kv: 0.4, in_service: true },
            { name: "Office Floor 1", vn_kv: 0.4, in_service: true },
            { name: "Office Floor 2", vn_kv: 0.4, in_service: true },
            { name: "HVAC Plant", vn_kv: 0.4, in_service: true }
          ],
          ext_grid: { bus_idx: 0, vm_pu: 1.02, min_vm_pu: 0.95, max_vm_pu: 1.05 },
          lines: [
            { from_bus: 1, to_bus: 2, length_km: 0.03, std_type: "NAYY 4x150 SE", in_service: true },
            { from_bus: 1, to_bus: 3, length_km: 0.03, std_type: "NAYY 4x150 SE", in_service: true },
            { from_bus: 1, to_bus: 4, length_km: 0.05, std_type: "NAYY 4x150 SE", in_service: true }
          ],
          loads: [
            { bus_idx: 2, p_mw: 0.05, q_mvar: 0.015, name: "Floor 1", in_service: true },
            { bus_idx: 3, p_mw: 0.05, q_mvar: 0.015, name: "Floor 2", in_service: true },
            { bus_idx: 4, p_mw: 0.08, q_mvar: 0.02, name: "HVAC", in_service: true }
          ],
          sgens: [],
          trafos: [
            { hv_bus: 0, lv_bus: 1, std_type: "0.63 MVA 11/0.4 kV", tap_pos: 0, in_service: true }
          ]
        },
        profiles: [
          { elementType: 'load', elementIndex: 0, variable: 'p_mw', values: this.getCommercialProfile() },
          { elementType: 'load', elementIndex: 1, variable: 'p_mw', values: this.getCommercialProfile() },
          { elementType: 'load', elementIndex: 2, variable: 'p_mw', values: this.getCommercialProfile().map(v => v * 1.5) }
        ]
      },
      'industrial-motor': {
        network: {
          buses: [
            { name: "Grid", vn_kv: 11, in_service: true },
            { name: "Main Panel", vn_kv: 0.4, in_service: true },
            { name: "Motor 1 (50HP)", vn_kv: 0.4, in_service: true },
            { name: "Motor 2 (30HP)", vn_kv: 0.4, in_service: true },
            { name: "Lighting", vn_kv: 0.4, in_service: true }
          ],
          ext_grid: { bus_idx: 0, vm_pu: 1.02, min_vm_pu: 0.95, max_vm_pu: 1.05 },
          lines: [
            { from_bus: 1, to_bus: 2, length_km: 0.05, std_type: "NAYY 4x185 SE", in_service: true },
            { from_bus: 1, to_bus: 3, length_km: 0.05, std_type: "NAYY 4x185 SE", in_service: true },
            { from_bus: 1, to_bus: 4, length_km: 0.03, std_type: "NAYY 4x50 SE", in_service: true }
          ],
          loads: [
            { bus_idx: 2, p_mw: 0.037, q_mvar: 0.02, name: "50HP Motor", in_service: true },
            { bus_idx: 3, p_mw: 0.022, q_mvar: 0.012, name: "30HP Motor", in_service: true },
            { bus_idx: 4, p_mw: 0.005, q_mvar: 0.001, name: "Lighting", in_service: true }
          ],
          sgens: [],
          trafos: [
            { hv_bus: 0, lv_bus: 1, std_type: "0.25 MVA 11/0.4 kV", tap_pos: 0, in_service: true }
          ]
        },
        profiles: []
      }
    };

    const demo = demos[type];
    if (!demo) return;

    this.network = JSON.parse(JSON.stringify(demo.network));
    this.tsProfiles = demo.profiles.map(p => ({...p}));

    // Switch to time-series if profiles exist
    if (this.tsProfiles.length > 0) {
      this.currentMode = 'timeseries';
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      document.querySelector('[data-mode="timeseries"]').classList.add('active');
      document.getElementById('ts-panel').classList.remove('hidden');
      document.getElementById('ts-steps').value = this.tsProfiles[0]?.values?.length || 96;
    } else {
      this.currentMode = 'snapshot';
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      document.querySelector('[data-mode="snapshot"]').classList.add('active');
      document.getElementById('ts-panel').classList.add('hidden');
    }

    this.renderAll();
    this.renderTsProfiles();
    this.hideResults();
    alert(`Demo loaded: ${type.replace('-', ' ')}. Tap "Run Analysis" to see results.`);
  },

  // Embedded profile generators (96 steps, 15-min)
  getResidentialLoadProfile() {
    return [0.25,0.22,0.20,0.18,0.18,0.17,0.17,0.16,0.16,0.15,0.15,0.15,0.16,0.18,0.22,0.28,0.35,0.42,0.50,0.58,0.65,0.72,0.80,0.88,0.95,1.00,1.05,1.10,1.15,1.18,1.20,1.18,1.15,1.10,1.05,1.00,0.95,0.90,0.85,0.82,0.80,0.78,0.75,0.75,0.75,0.76,0.78,0.80,0.82,0.82,0.80,0.78,0.78,0.80,0.82,0.82,0.80,0.78,0.78,0.80,0.85,0.90,0.95,1.00,1.05,1.10,1.15,1.18,1.20,1.22,1.25,1.28,1.30,1.28,1.25,1.20,1.15,1.10,1.05,1.00,0.95,0.90,0.85,0.80,0.70,0.60,0.50,0.42,0.35,0.32,0.30,0.28,0.27,0.26,0.25,0.25];
  },

  getSolarProfile() {
    return [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0.005,0.015,0.030,0.050,0.080,0.120,0.170,0.230,0.300,0.380,0.460,0.540,0.620,0.690,0.750,0.800,0.840,0.870,0.890,0.900,0.910,0.910,0.900,0.880,0.850,0.810,0.760,0.700,0.630,0.550,0.460,0.360,0.250,0.130,0.040,0.005,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
  },

  getCommercialProfile() {
    return [0.10,0.08,0.08,0.08,0.08,0.08,0.08,0.08,0.08,0.08,0.10,0.15,0.20,0.25,0.30,0.35,0.40,0.45,0.50,0.55,0.60,0.65,0.70,0.75,0.80,0.85,0.90,0.95,1.00,1.10,1.20,1.30,1.40,1.50,1.55,1.60,1.65,1.70,1.75,1.80,1.85,1.90,1.95,2.00,2.00,2.00,2.00,2.00,2.00,2.00,2.00,2.00,2.00,2.00,1.95,1.90,1.90,1.90,1.90,1.90,1.90,1.90,1.90,1.90,1.90,1.90,1.90,1.90,1.90,1.85,1.80,1.70,1.60,1.50,1.40,1.30,1.20,1.10,1.00,0.90,0.80,0.70,0.60,0.50,0.40,0.35,0.30,0.25,0.20,0.15,0.12,0.10,0.10,0.10,0.10,0.10];
  },

  // ─── CSV Import ───
  importCsv(type, input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const rows = this.parseCsv(e.target.result);
        if (type === 'buses') this.importBuses(rows);
        else if (type === 'lines') this.importLines(rows);
        else if (type === 'loads') this.importLoads(rows);
        else if (type === 'profile') this.importProfile(rows);
        this.renderAll();
      } catch (err) {
        alert('CSV import error: ' + err.message);
      }
    };
    reader.readAsText(file);
    input.value = '';
  },

  parseCsv(text) {
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
      const vals = line.split(',');
      const row = {};
      headers.forEach((h, i) => row[h] = vals[i]?.trim() ?? '');
      return row;
    });
  },

  importBuses(rows) {
    this.network.buses = rows.map(r => ({
      name: r.name || `Bus ${r.idx}`,
      vn_kv: parseFloat(r.vn_kv) || 11,
      in_service: parseInt(r.in_service) !== 0
    }));
  },

  importLines(rows) {
    this.network.lines = rows.map(r => ({
      from_bus: parseInt(r.from_bus) || 0,
      to_bus: parseInt(r.to_bus) || 0,
      length_km: parseFloat(r.length_km) || 1,
      std_type: r.std_type || "NAYY 4x150 SE",
      in_service: parseInt(r.in_service) !== 0
    }));
  },

  importLoads(rows) {
    this.network.loads = rows.map(r => ({
      bus_idx: parseInt(r.bus_idx) || 0,
      p_mw: parseFloat(r.p_mw) || 0.1,
      q_mvar: parseFloat(r.q_mvar) || 0.03,
      name: r.name || "Load",
      in_service: parseInt(r.in_service) !== 0
    }));
  },

  importProfile(rows) {
    const p_mw_col = rows[0]?.p_mw !== undefined ? 'p_mw' : (rows[0]?.['p_mw'] !== undefined ? 'p_mw' : null);
    if (!p_mw_col) { alert('Profile CSV must have a p_mw column'); return; }
    const values = rows.map(r => parseFloat(r.p_mw) || 0);
    if (this.network.loads.length === 0) { alert('Add loads before importing profiles'); return; }
    this.tsProfiles.push({
      elementType: 'load',
      elementIndex: 0,
      variable: 'p_mw',
      values: values
    });
    this.currentMode = 'timeseries';
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('[data-mode="timeseries"]').classList.add('active');
    document.getElementById('ts-panel').classList.remove('hidden');
    document.getElementById('ts-steps').value = values.length;
    this.renderTsProfiles();
  },

  // ─── Time-Series Profiles UI ───
  renderTsProfiles() {
    const container = document.getElementById('ts-profiles-container');
    container.innerHTML = '';
    this.tsProfiles.forEach((prof, i) => {
      const row = document.createElement('div');
      row.className = 'element-row';
      const elName = prof.elementType === 'load'
        ? (this.network.loads[prof.elementIndex]?.name || `Load ${prof.elementIndex}`)
        : (this.network.sgens[prof.elementIndex]?.name || `SGen ${prof.elementIndex}`);
      row.innerHTML = `
        <div class="element-header">
          <span>Profile ${i}: ${elName} → ${prof.variable}</span>
          <button class="btn btn-sm btn-danger" onclick="app.removeTsProfile(${i})">🗑️</button>
        </div>
        <div style="font-size:0.75rem;color:var(--color-text-muted);">
          ${prof.values.length} steps | Min: ${Math.min(...prof.values).toFixed(3)} | Max: ${Math.max(...prof.values).toFixed(3)} | Avg: ${(prof.values.reduce((a,b)=>a+b,0)/prof.values.length).toFixed(3)}
        </div>
      `;
      container.appendChild(row);
    });
  },

  addTsProfile() {
    if (this.network.loads.length === 0 && this.network.sgens.length === 0) {
      alert('Add loads or generators first'); return;
    }
    const values = Array(96).fill(0.1);
    this.tsProfiles.push({ elementType: 'load', elementIndex: 0, variable: 'p_mw', values });
    this.renderTsProfiles();
  },

  removeTsProfile(i) {
    this.tsProfiles.splice(i, 1);
    this.renderTsProfiles();
  },

  // ─── Form Rendering ───
  renderAll() {
    this.renderExtGrid();
    this.renderBuses();
    this.renderLines();
    this.renderLoads();
    this.renderSgens();
    this.renderTrafos();
    this.updateBusOptions();
  },

  renderExtGrid() {
    document.getElementById('ext-vm').value = this.network.ext_grid.vm_pu;
    document.getElementById('ext-min').value = this.network.ext_grid.min_vm_pu;
    document.getElementById('ext-max').value = this.network.ext_grid.max_vm_pu;
  },

  renderBuses() {
    const container = document.getElementById('buses-container');
    container.innerHTML = '';
    this.network.buses.forEach((bus, i) => {
      const row = document.createElement('div');
      row.className = 'element-row';
      row.innerHTML = `
        <div class="element-header"><span>Bus ${i}</span><div class="element-actions"><button class="btn btn-sm btn-danger" onclick="app.removeBus(${i})">🗑️</button></div></div>
        <div class="form-group"><label class="form-label">Name</label><input type="text" class="form-input" value="${bus.name}" onchange="app.updateBus(${i},'name',this.value)"></div>
        <div style="display:grid;grid-template-columns:2fr 1fr;gap:10px;">
          <div class="form-group"><label class="form-label">Nominal voltage (kV)</label><input type="number" step="0.1" class="form-input" value="${bus.vn_kv}" onchange="app.updateBus(${i},'vn_kv',parseFloat(this.value))"></div>
          <div class="form-group" style="display:flex;align-items:center;gap:8px;padding-top:22px;"><input type="checkbox" ${bus.in_service ? 'checked' : ''} onchange="app.updateBus(${i},'in_service',this.checked)"><label class="form-label" style="margin:0;">In service</label></div>
        </div>`;
      container.appendChild(row);
    });
    this.updateBusOptions();
  },

  addBus() {
    const idx = this.network.buses.length;
    this.network.buses.push({ name: `Bus ${idx}`, vn_kv: 11, in_service: true });
    this.renderBuses();
  },

  removeBus(i) {
    this.network.buses.splice(i, 1);
    this.network.lines = this.network.lines.filter(l => l.from_bus !== i && l.to_bus !== i).map(l => ({
      ...l, from_bus: l.from_bus > i ? l.from_bus - 1 : l.from_bus, to_bus: l.to_bus > i ? l.to_bus - 1 : l.to_bus
    }));
    this.network.loads = this.network.loads.filter(l => l.bus_idx !== i).map(l => ({...l, bus_idx: l.bus_idx > i ? l.bus_idx - 1 : l.bus_idx}));
    this.network.sgens = this.network.sgens.filter(s => s.bus_idx !== i).map(s => ({...s, bus_idx: s.bus_idx > i ? s.bus_idx - 1 : s.bus_idx}));
    this.network.trafos = this.network.trafos.filter(t => t.hv_bus !== i && t.lv_bus !== i).map(t => ({
      ...t, hv_bus: t.hv_bus > i ? t.hv_bus - 1 : t.hv_bus, lv_bus: t.lv_bus > i ? t.lv_bus - 1 : t.lv_bus
    }));
    if (this.network.ext_grid.bus_idx === i) this.network.ext_grid.bus_idx = 0;
    else if (this.network.ext_grid.bus_idx > i) this.network.ext_grid.bus_idx--;
    this.renderAll();
  },

  updateBus(i, field, value) {
    this.network.buses[i][field] = value;
    if (field === 'name') this.updateBusOptions();
  },

  renderLines() {
    const container = document.getElementById('lines-container');
    container.innerHTML = '';
    this.network.lines.forEach((line, i) => {
      const row = document.createElement('div');
      row.className = 'element-row';
      row.innerHTML = `
        <div class="element-header"><span>Line ${i}</span><div class="element-actions"><button class="btn btn-sm btn-danger" onclick="app.removeLine(${i})">🗑️</button></div></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div class="form-group"><label class="form-label">From bus</label><select class="form-select" onchange="app.updateLine(${i},'from_bus',parseInt(this.value))">${this.getBusOptions(line.from_bus)}</select></div>
          <div class="form-group"><label class="form-label">To bus</label><select class="form-select" onchange="app.updateLine(${i},'to_bus',parseInt(this.value))">${this.getBusOptions(line.to_bus)}</select></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div class="form-group"><label class="form-label">Length (km)</label><input type="number" step="0.01" class="form-input" value="${line.length_km}" onchange="app.updateLine(${i},'length_km',parseFloat(this.value))"></div>
          <div class="form-group"><label class="form-label">Standard type</label><select class="form-select" onchange="app.updateLine(${i},'std_type',this.value)">${STD_LINE_TYPES.map(t => `<option value="${t}" ${t === line.std_type ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
        </div>
        <div class="form-group" style="display:flex;align-items:center;gap:8px;"><input type="checkbox" ${line.in_service ? 'checked' : ''} onchange="app.updateLine(${i},'in_service',this.checked)"><label class="form-label" style="margin:0;">In service</label></div>`;
      container.appendChild(row);
    });
  },

  addLine() {
    const n = this.network.buses.length;
    if (n < 2) { alert('Need at least 2 buses'); return; }
    this.network.lines.push({ from_bus: 0, to_bus: n > 1 ? 1 : 0, length_km: 1.0, std_type: "NAYY 4x150 SE", in_service: true });
    this.renderLines();
  },

  removeLine(i) { this.network.lines.splice(i, 1); this.renderLines(); },
  updateLine(i, field, value) { this.network.lines[i][field] = value; },

  renderLoads() {
    const container = document.getElementById('loads-container');
    container.innerHTML = '';
    this.network.loads.forEach((load, i) => {
      const row = document.createElement('div');
      row.className = 'element-row';
      row.innerHTML = `
        <div class="element-header"><span>Load ${i}</span><div class="element-actions"><button class="btn btn-sm btn-danger" onclick="app.removeLoad(${i})">🗑️</button></div></div>
        <div class="form-group"><label class="form-label">Name</label><input type="text" class="form-input" value="${load.name}" onchange="app.updateLoad(${i},'name',this.value)"></div>
        <div class="form-group"><label class="form-label">Bus</label><select class="form-select" onchange="app.updateLoad(${i},'bus_idx',parseInt(this.value))">${this.getBusOptions(load.bus_idx)}</select></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div class="form-group"><label class="form-label">Active power P (MW)</label><input type="number" step="0.001" class="form-input" value="${load.p_mw}" onchange="app.updateLoad(${i},'p_mw',parseFloat(this.value))"></div>
          <div class="form-group"><label class="form-label">Reactive power Q (MVAr)</label><input type="number" step="0.001" class="form-input" value="${load.q_mvar}" onchange="app.updateLoad(${i},'q_mvar',parseFloat(this.value))"></div>
        </div>
        <div class="form-group" style="display:flex;align-items:center;gap:8px;"><input type="checkbox" ${load.in_service ? 'checked' : ''} onchange="app.updateLoad(${i},'in_service',this.checked)"><label class="form-label" style="margin:0;">In service</label></div>`;
      container.appendChild(row);
    });
  },

  addLoad() { this.network.loads.push({ bus_idx: 0, p_mw: 0.1, q_mvar: 0.03, name: `Load ${this.network.loads.length}`, in_service: true }); this.renderLoads(); },
  removeLoad(i) { this.network.loads.splice(i, 1); this.renderLoads(); },
  updateLoad(i, field, value) { this.network.loads[i][field] = value; },

  renderSgens() {
    const container = document.getElementById('sgens-container');
    container.innerHTML = '';
    this.network.sgens.forEach((sgen, i) => {
      const row = document.createElement('div');
      row.className = 'element-row';
      row.innerHTML = `
        <div class="element-header"><span>SGen ${i}</span><div class="element-actions"><button class="btn btn-sm btn-danger" onclick="app.removeSgen(${i})">🗑️</button></div></div>
        <div class="form-group"><label class="form-label">Name</label><input type="text" class="form-input" value="${sgen.name}" onchange="app.updateSgen(${i},'name',this.value)"></div>
        <div class="form-group"><label class="form-label">Bus</label><select class="form-select" onchange="app.updateSgen(${i},'bus_idx',parseInt(this.value))">${this.getBusOptions(sgen.bus_idx)}</select></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div class="form-group"><label class="form-label">Active power P (MW)</label><input type="number" step="0.001" class="form-input" value="${sgen.p_mw}" onchange="app.updateSgen(${i},'p_mw',parseFloat(this.value))"></div>
          <div class="form-group"><label class="form-label">Reactive power Q (MVAr)</label><input type="number" step="0.001" class="form-input" value="${sgen.q_mvar}" onchange="app.updateSgen(${i},'q_mvar',parseFloat(this.value))"></div>
        </div>
        <div class="form-group" style="display:flex;align-items:center;gap:8px;"><input type="checkbox" ${sgen.in_service ? 'checked' : ''} onchange="app.updateSgen(${i},'in_service',this.checked)"><label class="form-label" style="margin:0;">In service</label></div>`;
      container.appendChild(row);
    });
  },

  addSgen() { this.network.sgens.push({ bus_idx: 0, p_mw: 0.05, q_mvar: 0.0, name: `Solar ${this.network.sgens.length}`, in_service: true }); this.renderSgens(); },
  removeSgen(i) { this.network.sgens.splice(i, 1); this.renderSgens(); },
  updateSgen(i, field, value) { this.network.sgens[i][field] = value; },

  renderTrafos() {
    const container = document.getElementById('trafos-container');
    container.innerHTML = '';
    this.network.trafos.forEach((trafo, i) => {
      const row = document.createElement('div');
      row.className = 'element-row';
      row.innerHTML = `
        <div class="element-header"><span>Transformer ${i}</span><div class="element-actions"><button class="btn btn-sm btn-danger" onclick="app.removeTrafo(${i})">🗑️</button></div></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div class="form-group"><label class="form-label">HV bus</label><select class="form-select" onchange="app.updateTrafo(${i},'hv_bus',parseInt(this.value))">${this.getBusOptions(trafo.hv_bus)}</select></div>
          <div class="form-group"><label class="form-label">LV bus</label><select class="form-select" onchange="app.updateTrafo(${i},'lv_bus',parseInt(this.value))">${this.getBusOptions(trafo.lv_bus)}</select></div>
        </div>
        <div style="display:grid;grid-template-columns:2fr 1fr;gap:10px;">
          <div class="form-group"><label class="form-label">Standard type</label><select class="form-select" onchange="app.updateTrafo(${i},'std_type',this.value)">${STD_TRAFO_TYPES.map(t => `<option value="${t}" ${t === trafo.std_type ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
          <div class="form-group"><label class="form-label">Tap position</label><input type="number" step="1" class="form-input" value="${trafo.tap_pos}" onchange="app.updateTrafo(${i},'tap_pos',parseInt(this.value))"></div>
        </div>
        <div class="form-group" style="display:flex;align-items:center;gap:8px;"><input type="checkbox" ${trafo.in_service ? 'checked' : ''} onchange="app.updateTrafo(${i},'in_service',this.checked)"><label class="form-label" style="margin:0;">In service</label></div>`;
      container.appendChild(row);
    });
  },

  addTrafo() { this.network.trafos.push({ hv_bus: 0, lv_bus: 1, std_type: "0.25 MVA 11/0.4 kV", tap_pos: 0, in_service: true }); this.renderTrafos(); },
  removeTrafo(i) { this.network.trafos.splice(i, 1); this.renderTrafos(); },
  updateTrafo(i, field, value) { this.network.trafos[i][field] = value; },

  getBusOptions(selectedIdx) {
    return this.network.buses.map((b, i) => `<option value="${i}" ${i === selectedIdx ? 'selected' : ''}>${i}: ${b.name} (${b.vn_kv} kV)</option>`).join('');
  },

  updateBusOptions() {
    const extSelect = document.getElementById('ext-bus');
    if (extSelect) {
      extSelect.innerHTML = this.getBusOptions(this.network.ext_grid.bus_idx);
      extSelect.onchange = (e) => { this.network.ext_grid.bus_idx = parseInt(e.target.value); };
    }
  },

  getNetworkConfig() {
    return { version: "1.0", name: "Custom Network", buses: this.network.buses, ext_grid: this.network.ext_grid, lines: this.network.lines, loads: this.network.loads, sgens: this.network.sgens, trafos: this.network.trafos, mode: this.currentMode, tsProfiles: this.tsProfiles };
  },

  // ─── Analysis Execution ───
  async runAnalysis() {
    if (!this.pyodideReady) { alert('Python runtime not ready yet. Please wait.'); return; }
    const runBtn = document.getElementById('run-btn');
    runBtn.disabled = true;
    runBtn.textContent = this.currentMode === 'timeseries' ? '⏳ Running Time-Series…' : '⏳ Running…';

    try {
      if (this.currentMode === 'timeseries') {
        const result = await this.runTimeSeries();
        this.lastResult = result;
        this.displayTimeSeriesResults(result);
      } else {
        const pythonCode = this.generatePythonCode();
        const resultJson = await this.pyodide.runPythonAsync(pythonCode);
        const result = JSON.parse(resultJson);
        this.lastResult = result;
        this.displaySnapshotResults(result);
      }
    } catch (err) {
      console.error(err);
      alert('Analysis failed: ' + err.message);
    } finally {
      runBtn.disabled = false;
      runBtn.textContent = '▶ Run Analysis';
    }
  },

  generatePythonCode() {
    const n = this.network;
    return `
import pandapower as pp
import json

net = pp.create_empty_network()
${n.buses.map((b, i) => `b${i} = pp.create_bus(net, vn_kv=${b.vn_kv}, name="${b.name}", in_service=${b.in_service})`).join('\n')}
pp.create_ext_grid(net, b${n.ext_grid.bus_idx}, vm_pu=${n.ext_grid.vm_pu})
${n.lines.map(l => `pp.create_line(net, b${l.from_bus}, b${l.to_bus}, length_km=${l.length_km}, std_type="${l.std_type}", in_service=${l.in_service})`).join('\n')}
${n.loads.map(l => `pp.create_load(net, b${l.bus_idx}, p_mw=${l.p_mw}, q_mvar=${l.q_mvar}, name="${l.name}", in_service=${l.in_service})`).join('\n')}
${n.sgens.map(s => `pp.create_sgen(net, b${s.bus_idx}, p_mw=${s.p_mw}, q_mvar=${s.q_mvar}, name="${s.name}", in_service=${s.in_service})`).join('\n')}
${n.trafos.map(t => `pp.create_transformer(net, b${t.hv_bus}, b${t.lv_bus}, std_type="${t.std_type}", tap_pos=${t.tap_pos}, in_service=${t.in_service})`).join('\n')}

try:
    pp.runpp(net, algorithm='nr', tolerance_mva=1e-8, max_iteration=50)
    result = {
        "converged": bool(net.converged),
        "iterations": int(net._ppc.get("iterations", 0)),
        "res_bus": net.res_bus[['vm_pu','va_degree','p_mw','q_mvar']].reset_index().rename(columns={'index':'bus_idx'}).to_dict(orient='records'),
        "res_line": net.res_line[['p_from_mw','q_from_mvar','p_to_mw','q_to_mvar','pl_mw','ql_mvar','i_from_ka','loading_percent']].reset_index().rename(columns={'index':'line_idx'}).to_dict(orient='records'),
        "res_trafo": net.res_trafo[['p_hv_mw','q_hv_mvar','p_lv_mw','q_lv_mvar','pl_mw','ql_mvar','loading_percent']].reset_index().rename(columns={'index':'trafo_idx'}).to_dict(orient='records'),
        "bus_names": net.bus['name'].tolist()
    }
except Exception as e:
    result = {"converged": False, "error": str(e)}
json.dumps(result)
`;
  },

  async runTimeSeries() {
    const n = this.network;
    const steps = parseInt(document.getElementById('ts-steps').value) || 96;
    const profilesCode = this.tsProfiles.map((p, i) => {
      const vals = JSON.stringify(p.values.slice(0, steps));
      const el = p.elementType === 'load' ? 'load' : 'sgen';
      return `
ds${i} = ts.DFData(pd.DataFrame({"prof": ${vals}}))
ctrl.ConstControl(net, element='${el}', variable='${p.variable}', element_index=${p.elementIndex}, data_source=ds${i}, profile_name='prof')`;
    }).join('\n');

    const code = `
import pandapower as pp
import pandapower.timeseries as ts
import pandapower.control as ctrl
import pandas as pd
import json

net = pp.create_empty_network()
${n.buses.map((b, i) => `b${i} = pp.create_bus(net, vn_kv=${b.vn_kv}, name="${b.name}", in_service=${b.in_service})`).join('\n')}
pp.create_ext_grid(net, b${n.ext_grid.bus_idx}, vm_pu=${n.ext_grid.vm_pu})
${n.lines.map(l => `pp.create_line(net, b${l.from_bus}, b${l.to_bus}, length_km=${l.length_km}, std_type="${l.std_type}", in_service=${l.in_service})`).join('\n')}
${n.loads.map(l => `pp.create_load(net, b${l.bus_idx}, p_mw=${l.p_mw}, q_mvar=${l.q_mvar}, name="${l.name}", in_service=${l.in_service})`).join('\n')}
${n.sgens.map(s => `pp.create_sgen(net, b${s.bus_idx}, p_mw=${s.p_mw}, q_mvar=${s.q_mvar}, name="${s.name}", in_service=${s.in_service})`).join('\n')}
${n.trafos.map(t => `pp.create_transformer(net, b${t.hv_bus}, b${t.lv_bus}, std_type="${t.std_type}", tap_pos=${t.tap_pos}, in_service=${t.in_service})`).join('\n')}

${profilesCode}

ow = ts.OutputWriter(net, output_path=None, output_file_type=".json")
ow.log_variable('res_bus', 'vm_pu')
ow.log_variable('res_line', 'loading_percent')

ts.run_timeseries(net, time_steps=range(${steps}), continue_on_divergence=False, verbose=False)

v_df = ow.output['res_bus.vm_pu']
l_df = ow.output['res_line.loading_percent']

result = {
    "converged": True,
    "steps": ${steps},
    "voltage_min": v_df.min().min(),
    "voltage_max": v_df.max().max(),
    "loading_max": l_df.max().max() if len(l_df) > 0 else 0,
    "violation_count": int(((v_df < 0.95) | (v_df > 1.05)).sum().sum()),
    "overload_count": int((l_df > 100).sum().sum()),
    "bus_names": net.bus['name'].tolist(),
    "voltage_profile": v_df.mean(axis=1).tolist(),
    "loading_profile": l_df.mean(axis=1).tolist() if len(l_df) > 0 else []
}
json.dumps(result)
`;
    const resultJson = await this.pyodide.runPythonAsync(code);
    return JSON.parse(resultJson);
  },

  // ─── Results Display ───
  displaySnapshotResults(result) {
    const section = document.getElementById('results-section');
    const content = document.getElementById('results-content');
    section.classList.remove('hidden');

    if (!result.converged) {
      content.innerHTML = `<div class="alert alert-danger">❌ Power flow did not converge<br><small>${result.error || 'Check network connectivity and loading levels.'}</small></div>`;
      section.scrollIntoView({ behavior: 'smooth' }); return;
    }

    const buses = result.res_bus;
    const lines = result.res_line;
    const trafos = result.res_trafo;
    const busNames = result.bus_names;

    const minVm = Math.min(...buses.map(b => b.vm_pu));
    const maxVm = Math.max(...buses.map(b => b.vm_pu));
    const maxLineLoad = lines.length > 0 ? Math.max(...lines.map(l => l.loading_percent)) : 0;
    const maxTrafoLoad = trafos.length > 0 ? Math.max(...trafos.map(t => t.loading_percent)) : 0;
    const totalLosses = lines.reduce((s, l) => s + l.pl_mw, 0) + trafos.reduce((s, t) => s + t.pl_mw, 0);
    const minVmBus = busNames[buses.find(b => b.vm_pu === minVm)?.bus_idx ?? 0];
    const maxLoadLineName = lines.length > 0 ? `Line ${lines.find(l => l.loading_percent === maxLineLoad)?.line_idx ?? 0}` : 'N/A';

    let overallStatus = 'pass';
    if (minVm < 0.90 || maxVm > 1.10 || maxLineLoad > 100 || maxTrafoLoad > 100) overallStatus = 'fail';
    else if (minVm < 0.95 || maxVm > 1.05 || maxLineLoad > 90 || maxTrafoLoad > 90) overallStatus = 'warn';

    const statusEmoji = { pass: '🟢', warn: '🟡', fail: '🔴' };
    const statusText = { pass: 'PASS', warn: 'WATCH', fail: 'FAIL' };

    let html = `
      <div class="alert ${overallStatus === 'pass' ? 'alert-success' : overallStatus === 'warn' ? 'alert-warning' : 'alert-danger'}">
        ${statusEmoji[overallStatus]} <strong>${statusText[overallStatus]}</strong> — Converged in ${result.iterations} iterations
      </div>
      <div class="summary-cards">
        <div class="summary-card status-${minVm >= 0.95 ? 'pass' : minVm >= 0.90 ? 'warn' : 'fail'}"><div class="summary-label">Min Voltage</div><div class="summary-value">${minVm.toFixed(3)} pu</div><div class="summary-detail">${minVmBus}</div></div>
        <div class="summary-card status-${maxVm <= 1.05 ? 'pass' : maxVm <= 1.10 ? 'warn' : 'fail'}"><div class="summary-label">Max Voltage</div><div class="summary-value">${maxVm.toFixed(3)} pu</div><div class="summary-detail">Highest bus</div></div>
        <div class="summary-card status-${maxLineLoad <= 70 ? 'pass' : maxLineLoad <= 90 ? 'warn' : 'fail'}"><div class="summary-label">Max Line Load</div><div class="summary-value">${maxLineLoad.toFixed(1)}%</div><div class="summary-detail">${maxLoadLineName}</div></div>
        <div class="summary-card"><div class="summary-label">Total Losses</div><div class="summary-value">${(totalLosses * 1000).toFixed(1)} kW</div><div class="summary-detail">Lines + Trafos</div></div>
      </div>`;

    html += this.renderBusTable(buses, busNames);
    if (lines.length > 0) html += this.renderLineTable(lines);
    if (trafos.length > 0) html += this.renderTrafoTable(trafos);

    html += `<div style="display:flex;gap:10px;padding:0 0 20px;flex-wrap:wrap;">
      <button class="btn btn-secondary" onclick="app.saveJson()">💾 Save JSON</button>
      <button class="btn btn-secondary" onclick="app.loadJsonPrompt()">📂 Load JSON</button>
      <button class="btn btn-secondary" onclick="app.generateReport()">📄 Generate Report</button>
    </div>`;

    content.innerHTML = html;
    section.scrollIntoView({ behavior: 'smooth' });
  },

  displayTimeSeriesResults(result) {
    const section = document.getElementById('results-section');
    const content = document.getElementById('results-content');
    section.classList.remove('hidden');

    let overallStatus = 'pass';
    if (result.violation_count > 0 || result.overload_count > 0) overallStatus = 'fail';
    else if (result.voltage_min < 0.95 || result.voltage_max > 1.05 || result.loading_max > 90) overallStatus = 'warn';

    const statusEmoji = { pass: '🟢', warn: '🟡', fail: '🔴' };
    const statusText = { pass: 'PASS', warn: 'WATCH', fail: 'FAIL' };

    let html = `
      <div class="alert ${overallStatus === 'pass' ? 'alert-success' : overallStatus === 'warn' ? 'alert-warning' : 'alert-danger'}">
        ${statusEmoji[overallStatus]} <strong>${statusText[overallStatus]}</strong> — ${result.steps} time steps simulated
      </div>
      <div class="summary-cards">
        <div class="summary-card status-${result.voltage_min >= 0.95 ? 'pass' : 'fail'}"><div class="summary-label">Min Voltage</div><div class="summary-value">${result.voltage_min.toFixed(3)} pu</div><div class="summary-detail">Worst case</div></div>
        <div class="summary-card status-${result.voltage_max <= 1.05 ? 'pass' : 'fail'}"><div class="summary-label">Max Voltage</div><div class="summary-value">${result.voltage_max.toFixed(3)} pu</div><div class="summary-detail">Worst case</div></div>
        <div class="summary-card status-${result.loading_max <= 90 ? 'pass' : 'fail'}"><div class="summary-label">Max Loading</div><div class="summary-value">${result.loading_max.toFixed(1)}%</div><div class="summary-detail">Any branch</div></div>
        <div class="summary-card status-${result.violation_count === 0 ? 'pass' : 'fail'}"><div class="summary-label">Violations</div><div class="summary-value">${result.violation_count}</div><div class="summary-detail">Voltage out of range</div></div>
      </div>
      <div style="padding:0 0 12px;font-size:0.85rem;color:var(--color-text-muted);">
        Overloads (loading > 100%): <strong>${result.overload_count}</strong> time-step occurrences
      </div>
    `;

    // Simple ASCII bar chart for voltage profile
    html += `<div class="section-header">Average Voltage Profile (24h)</div>`;
    html += `<div class="form-card"><div class="form-card-body" style="font-family:monospace;font-size:0.75rem;overflow-x:auto;">`;
    const vProf = result.voltage_profile;
    const vMin = Math.min(...vProf);
    const vMax = Math.max(...vProf);
    vProf.forEach((v, i) => {
      const hour = Math.floor(i * 24 / vProf.length);
      const min = Math.floor((i * 24 / vProf.length - hour) * 60);
      const time = `${hour.toString().padStart(2,'0')}:${min.toString().padStart(2,'0')}`;
      const barLen = Math.round((v - 0.90) / 0.20 * 40);
      const bar = '█'.repeat(Math.max(0, barLen)) + '░'.repeat(Math.max(0, 40 - barLen));
      const color = v >= 0.95 && v <= 1.05 ? 'var(--color-success)' : v >= 0.90 && v <= 1.10 ? 'var(--color-warning)' : 'var(--color-danger)';
      html += `<div style="display:flex;gap:8px;align-items:center;white-space:nowrap;"><span style="width:40px;">${time}</span><span style="color:${color};">${bar}</span> <span>${v.toFixed(3)} pu</span></div>`;
    });
    html += `</div></div>`;

    html += `<div style="display:flex;gap:10px;padding:0 0 20px;flex-wrap:wrap;">
      <button class="btn btn-secondary" onclick="app.saveJson()">💾 Save JSON</button>
      <button class="btn btn-secondary" onclick="app.loadJsonPrompt()">📂 Load JSON</button>
      <button class="btn btn-secondary" onclick="app.generateReport()">📄 Generate Report</button>
    </div>`;

    content.innerHTML = html;
    section.scrollIntoView({ behavior: 'smooth' });
  },

  renderBusTable(buses, busNames) {
    let html = `<div class="section-header">Bus Results</div><div class="result-table-container"><table class="result-table"><thead><tr><th>Bus</th><th>Name</th><th>Voltage (pu)</th><th>Angle (°)</th><th>P (MW)</th><th>Q (MVAr)</th><th>Status</th></tr></thead><tbody>`;
    buses.forEach(b => {
      const status = b.vm_pu >= 0.95 && b.vm_pu <= 1.05 ? 'pass' : b.vm_pu >= 0.90 && b.vm_pu <= 1.10 ? 'warn' : 'fail';
      html += `<tr><td>${b.bus_idx}</td><td>${busNames[b.bus_idx] || `Bus ${b.bus_idx}`}</td><td class="cell-${status === 'pass' ? 'green' : status === 'warn' ? 'amber' : 'red'}">${b.vm_pu.toFixed(4)}</td><td>${b.va_degree.toFixed(2)}</td><td>${b.p_mw.toFixed(3)}</td><td>${b.q_mvar.toFixed(3)}</td><td class="cell-${status === 'pass' ? 'green' : status === 'warn' ? 'amber' : 'red'}">${status === 'pass' ? 'OK' : status === 'warn' ? 'Watch' : 'Violation'}</td></tr>`;
    });
    return html + '</tbody></table></div>';
  },

  renderLineTable(lines) {
    let html = `<div class="section-header">Line Results</div><div class="result-table-container"><table class="result-table"><thead><tr><th>Line</th><th>P from (MW)</th><th>P to (MW)</th><th>Losses (kW)</th><th>Current (kA)</th><th>Loading (%)</th><th>Status</th></tr></thead><tbody>`;
    lines.forEach(l => {
      const status = l.loading_percent <= 70 ? 'pass' : l.loading_percent <= 90 ? 'warn' : 'fail';
      html += `<tr><td>${l.line_idx}</td><td>${l.p_from_mw.toFixed(3)}</td><td>${l.p_to_mw.toFixed(3)}</td><td>${(l.pl_mw * 1000).toFixed(1)}</td><td>${l.i_from_ka.toFixed(3)}</td><td class="cell-${status === 'pass' ? 'green' : status === 'warn' ? 'amber' : 'red'}">${l.loading_percent.toFixed(1)}%</td><td class="cell-${status === 'pass' ? 'green' : status === 'warn' ? 'amber' : 'red'}">${status === 'pass' ? 'OK' : status === 'warn' ? 'Watch' : 'Overload'}</td></tr>`;
    });
    return html + '</tbody></table></div>';
  },

  renderTrafoTable(trafos) {
    let html = `<div class="section-header">Transformer Results</div><div class="result-table-container"><table class="result-table"><thead><tr><th>Trafo</th><th>P HV (MW)</th><th>P LV (MW)</th><th>Losses (kW)</th><th>Loading (%)</th><th>Status</th></tr></thead><tbody>`;
    trafos.forEach(t => {
      const status = t.loading_percent <= 70 ? 'pass' : t.loading_percent <= 90 ? 'warn' : 'fail';
      html += `<tr><td>${t.trafo_idx}</td><td>${t.p_hv_mw.toFixed(3)}</td><td>${t.p_lv_mw.toFixed(3)}</td><td>${(t.pl_mw * 1000).toFixed(1)}</td><td class="cell-${status === 'pass' ? 'green' : status === 'warn' ? 'amber' : 'red'}">${t.loading_percent.toFixed(1)}%</td><td class="cell-${status === 'pass' ? 'green' : status === 'warn' ? 'amber' : 'red'}">${status === 'pass' ? 'OK' : status === 'warn' ? 'Watch' : 'Overload'}</td></tr>`;
    });
    return html + '</tbody></table></div>';
  },

  hideResults() {
    document.getElementById('results-section').classList.add('hidden');
  },

  // ─── Report Generator ───
  generateReport() {
    if (!this.lastResult) { alert('Run an analysis first'); return; }
    const result = this.lastResult;
    const now = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
    const cfg = this.getNetworkConfig();

    let reportHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>CGG PowerFlow Report</title><style>
      body{font-family:Arial,sans-serif;margin:40px;color:#1a1a1a;line-height:1.6}
      .header{border-bottom:3px solid #003366;padding-bottom:20px;margin-bottom:30px}
      .header h1{color:#003366;margin:0;font-size:28px}
      .header p{margin:4px 0;color:#666;font-size:14px}
      .section{margin-bottom:30px}
      .section h2{color:#003366;border-bottom:1px solid #ddd;padding-bottom:8px;font-size:18px}
      table{width:100%;border-collapse:collapse;margin:15px 0;font-size:13px}
      th{background:#003366;color:white;padding:10px;text-align:left}
      td{padding:8px 10px;border-bottom:1px solid #eee}
      tr:nth-child(even){background:#f9f9f9}
      .status-ok{color:#22c55e;font-weight:bold}
      .status-warn{color:#f59e0b;font-weight:bold}
      .status-fail{color:#ef4444;font-weight:bold}
      .summary-box{display:grid;grid-template-columns:repeat(4,1fr);gap:15px;margin:20px 0}
      .box{background:#f5f5f5;padding:15px;border-radius:8px;text-align:center;border-left:4px solid #003366}
      .box h3{margin:0 0 8px;font-size:24px;color:#003366}
      .box p{margin:0;font-size:12px;color:#666}
      .recommendations{background:#fffbeb;border:1px solid #f59e0b;padding:15px;border-radius:8px}
      .recommendations h3{color:#92400e;margin-top:0}
      .recommendations ul{margin:8px 0;padding-left:20px}
      .recommendations li{margin:4px 0}
      .footer{margin-top:40px;padding-top:20px;border-top:1px solid #ddd;font-size:12px;color:#999;text-align:center}
      @media print{body{margin:20px}}
    </style></head><body>`;

    reportHtml += `
      <div class="header">
        <h1>⚡ Comfac Global Group — Power Flow Analysis Report</h1>
        <p><strong>Generated:</strong> ${now}</p>
        <p><strong>Analysis Type:</strong> ${this.currentMode === 'timeseries' ? 'Time-Series (24-hour simulation)' : 'Single Snapshot'}</p>
        <p><strong>Network:</strong> ${cfg.buses.length} buses, ${cfg.lines.length} lines, ${cfg.loads.length} loads, ${cfg.trafos.length} transformers</p>
      </div>
    `;

    if (this.currentMode === 'snapshot' && result.converged) {
      const buses = result.res_bus;
      const lines = result.res_line;
      const trafos = result.res_trafo;
      const minVm = Math.min(...buses.map(b => b.vm_pu));
      const maxVm = Math.max(...buses.map(b => b.vm_pu));
      const maxLoad = Math.max(...lines.map(l => l.loading_percent), ...trafos.map(t => t.loading_percent));
      const totalLoss = lines.reduce((s,l)=>s+l.pl_mw,0) + trafos.reduce((s,t)=>s+t.pl_mw,0);

      reportHtml += `<div class="section"><h2>Executive Summary</h2><div class="summary-box">`;
      reportHtml += `<div class="box"><h3>${minVm.toFixed(3)}</h3><p>Min Voltage (pu)</p></div>`;
      reportHtml += `<div class="box"><h3>${maxVm.toFixed(3)}</h3><p>Max Voltage (pu)</p></div>`;
      reportHtml += `<div class="box"><h3>${maxLoad.toFixed(1)}%</h3><p>Max Loading</p></div>`;
      reportHtml += `<div class="box"><h3>${(totalLoss*1000).toFixed(1)}</h3><p>Total Losses (kW)</p></div>`;
      reportHtml += `</div></div>`;

      reportHtml += `<div class="section"><h2>Bus Voltage Results</h2><table><thead><tr><th>Bus</th><th>Name</th><th>Voltage (pu)</th><th>Angle (°)</th><th>Status</th></tr></thead><tbody>`;
      buses.forEach(b => {
        const status = b.vm_pu >= 0.95 && b.vm_pu <= 1.05 ? 'ok' : b.vm_pu >= 0.90 && b.vm_pu <= 1.10 ? 'warn' : 'fail';
        reportHtml += `<tr><td>${b.bus_idx}</td><td>${result.bus_names[b.bus_idx] || ''}</td><td>${b.vm_pu.toFixed(4)}</td><td>${b.va_degree.toFixed(2)}</td><td class="status-${status}">${status === 'ok' ? 'OK' : status === 'warn' ? 'Watch' : 'Violation'}</td></tr>`;
      });
      reportHtml += `</tbody></table></div>`;

      if (lines.length > 0) {
        reportHtml += `<div class="section"><h2>Line Loading Results</h2><table><thead><tr><th>Line</th><th>Loading (%)</th><th>Current (kA)</th><th>Losses (kW)</th><th>Status</th></tr></thead><tbody>`;
        lines.forEach(l => {
          const status = l.loading_percent <= 70 ? 'ok' : l.loading_percent <= 90 ? 'warn' : 'fail';
          reportHtml += `<tr><td>${l.line_idx}</td><td>${l.loading_percent.toFixed(1)}%</td><td>${l.i_from_ka.toFixed(3)}</td><td>${(l.pl_mw*1000).toFixed(1)}</td><td class="status-${status}">${status === 'ok' ? 'OK' : status === 'warn' ? 'Watch' : 'Overload'}</td></tr>`;
        });
        reportHtml += `</tbody></table></div>`;
      }
    } else if (this.currentMode === 'timeseries') {
      reportHtml += `<div class="section"><h2>Time-Series Summary (24 Hours)</h2><div class="summary-box">`;
      reportHtml += `<div class="box"><h3>${result.voltage_min.toFixed(3)}</h3><p>Min Voltage (pu)</p></div>`;
      reportHtml += `<div class="box"><h3>${result.voltage_max.toFixed(3)}</h3><p>Max Voltage (pu)</p></div>`;
      reportHtml += `<div class="box"><h3>${result.loading_max.toFixed(1)}%</h3><p>Max Loading</p></div>`;
      reportHtml += `<div class="box"><h3>${result.violation_count}</h3><p>Voltage Violations</p></div>`;
      reportHtml += `</div></div>`;
    }

    // Auto-generated recommendations
    const recs = [];
    if (this.currentMode === 'snapshot' && result.converged) {
      const minVm = Math.min(...result.res_bus.map(b => b.vm_pu));
      const maxLoad = Math.max(...result.res_line.map(l => l.loading_percent), ...result.res_trafo.map(t => t.loading_percent));
      if (minVm < 0.95) recs.push('Voltage below 0.95 pu detected. Consider upsizing cables or adding capacitor banks.');
      if (minVm < 0.90) recs.push('CRITICAL: Severe undervoltage. Immediate grid reinforcement recommended.');
      if (maxLoad > 100) recs.push('Thermal overload detected. Reduce load or upgrade conductor/transformer capacity.');
      if (maxLoad > 90) recs.push('Loading approaching thermal limit. Monitor temperatures and plan upgrade.');
      if (recs.length === 0) recs.push('All parameters within acceptable limits. No immediate action required.');
    } else if (this.currentMode === 'timeseries') {
      if (result.violation_count > 0) recs.push(`Voltage violations occurred in ${result.violation_count} time-step instances. Review peak load and generation profiles.`);
      if (result.overload_count > 0) recs.push(`Thermal overloads detected in ${result.overload_count} time-step instances. Consider demand-side management or capacity upgrade.`);
      if (recs.length === 0) recs.push('No violations detected across the simulated time period. System operates within limits.');
    }

    reportHtml += `<div class="section recommendations"><h3>🔧 Recommendations</h3><ul>`;
    recs.forEach(r => reportHtml += `<li>${r}</li>`);
    reportHtml += `</ul></div>`;

    reportHtml += `<div class="footer">
      <p>Generated by CGG PowerFlow Web — Comfac Global Group</p>
      <p>This report is for analysis purposes only and does not replace qualified engineering judgment.</p>
    </div></body></html>`;

    const win = window.open('', '_blank');
    win.document.write(reportHtml);
    win.document.close();
    setTimeout(() => win.print(), 500);
  },

  // ─── JSON Save/Load ───
  saveJson() {
    const config = this.getNetworkConfig();
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cgg-network.json';
    a.click();
    URL.revokeObjectURL(url);
  },

  loadJsonPrompt() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try { this.loadConfig(JSON.parse(ev.target.result)); }
        catch (err) { alert('Invalid JSON file'); }
      };
      reader.readAsText(file);
    };
    input.click();
  },

  loadConfig(config) {
    this.network.buses = config.buses || [];
    this.network.lines = config.lines || [];
    this.network.loads = config.loads || [];
    this.network.sgens = config.sgens || [];
    this.network.trafos = config.trafos || [];
    this.network.ext_grid = config.ext_grid || { bus_idx: 0, vm_pu: 1.02, min_vm_pu: 0.95, max_vm_pu: 1.05 };
    this.tsProfiles = config.tsProfiles || [];
    if (config.mode === 'timeseries') {
      this.currentMode = 'timeseries';
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      document.querySelector('[data-mode="timeseries"]').classList.add('active');
      document.getElementById('ts-panel').classList.remove('hidden');
    }
    this.renderAll();
    this.renderTsProfiles();
    this.hideResults();
  }
};

document.addEventListener('DOMContentLoaded', () => app.init());
