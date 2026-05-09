/**
 * CGG PowerFlow Web — Main Application Logic
 * FDR-001: One-Tap Network Templates (implemented)
 * FDR-006: Offline PDF (Phase 2)
 */

const app = {
  pyodide: null,
  pyodideReady: false,
  currentMode: 'snapshot',
  network: {
    buses: [],
    lines: [],
    loads: [],
    sgens: [],
    trafos: [],
    ext_grid: { bus_idx: 0, vm_pu: 1.02, min_vm_pu: 0.95, max_vm_pu: 1.05 }
  },

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
      await this.pyodide.runPythonAsync(`
        import micropip
        await micropip.install('pandapower')
      `);
      progressFill.style.width = '100%';

      this.pyodideReady = true;
      statusText.textContent = 'Ready';
      statusDot.classList.add('ready');
      runBtn.disabled = false;

      setTimeout(() => {
        loader.classList.add('hidden');
      }, 500);
    } catch (err) {
      statusText.textContent = 'Load failed — reload page';
      console.error('Pyodide load error:', err);
      alert('Failed to load Python runtime. Please check your connection and reload.');
    }
  },

  // ─── Mode Toggle ───
  bindModeToggle() {
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentMode = btn.dataset.mode;
      });
    });
  },

  // ─── Template Selector (FDR-001) ───
  renderTemplates() {
    const grid = document.getElementById('template-grid');
    grid.innerHTML = '';
    Object.entries(NETWORK_TEMPLATES).forEach(([key, tpl]) => {
      const card = document.createElement('div');
      card.className = 'template-card';
      card.dataset.key = key;
      card.innerHTML = `
        <div class="template-icon">${tpl.icon}</div>
        <div class="template-name">${tpl.name}</div>
        <div class="template-desc">${tpl.description}</div>
      `;
      card.addEventListener('click', () => this.loadTemplate(key));
      grid.appendChild(card);
    });
  },

  loadTemplate(key) {
    const tpl = NETWORK_TEMPLATES[key];
    if (!tpl) return;

    // Highlight selected card
    document.querySelectorAll('.template-card').forEach(c => c.classList.remove('selected'));
    document.querySelector(`.template-card[data-key="${key}"]`).classList.add('selected');

    // Deep copy template into network state
    this.network = JSON.parse(JSON.stringify({
      buses: tpl.buses,
      lines: tpl.lines,
      loads: tpl.loads,
      sgens: tpl.sgens,
      trafos: tpl.trafos,
      ext_grid: tpl.ext_grid
    }));

    this.renderAll();
    this.hideResults();

    // Scroll to network builder
    document.querySelector('.section-header:nth-of-type(2)').scrollIntoView({ behavior: 'smooth' });
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
        <div class="element-header">
          <span>Bus ${i}</span>
          <div class="element-actions">
            <button class="btn btn-sm btn-danger" onclick="app.removeBus(${i})">🗑️</button>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Name</label>
          <input type="text" class="form-input" value="${bus.name}" onchange="app.updateBus(${i},'name',this.value)">
        </div>
        <div style="display:grid;grid-template-columns:2fr 1fr;gap:10px;">
          <div class="form-group">
            <label class="form-label">Nominal voltage (kV)</label>
            <input type="number" step="0.1" class="form-input" value="${bus.vn_kv}" onchange="app.updateBus(${i},'vn_kv',parseFloat(this.value))">
          </div>
          <div class="form-group" style="display:flex;align-items:center;gap:8px;padding-top:22px;">
            <input type="checkbox" ${bus.in_service ? 'checked' : ''} onchange="app.updateBus(${i},'in_service',this.checked)">
            <label class="form-label" style="margin:0;">In service</label>
          </div>
        </div>
      `;
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
    // Clean up references
    this.network.lines = this.network.lines.filter(l => l.from_bus !== i && l.to_bus !== i)
      .map(l => ({
        ...l,
        from_bus: l.from_bus > i ? l.from_bus - 1 : l.from_bus,
        to_bus: l.to_bus > i ? l.to_bus - 1 : l.to_bus
      }));
    this.network.loads = this.network.loads.filter(l => l.bus_idx !== i)
      .map(l => ({ ...l, bus_idx: l.bus_idx > i ? l.bus_idx - 1 : l.bus_idx }));
    this.network.sgens = this.network.sgens.filter(s => s.bus_idx !== i)
      .map(s => ({ ...s, bus_idx: s.bus_idx > i ? s.bus_idx - 1 : s.bus_idx }));
    this.network.trafos = this.network.trafos.filter(t => t.hv_bus !== i && t.lv_bus !== i)
      .map(t => ({
        ...t,
        hv_bus: t.hv_bus > i ? t.hv_bus - 1 : t.hv_bus,
        lv_bus: t.lv_bus > i ? t.lv_bus - 1 : t.lv_bus
      }));
    if (this.network.ext_grid.bus_idx === i) {
      this.network.ext_grid.bus_idx = 0;
    } else if (this.network.ext_grid.bus_idx > i) {
      this.network.ext_grid.bus_idx--;
    }
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
        <div class="element-header">
          <span>Line ${i}</span>
          <div class="element-actions">
            <button class="btn btn-sm btn-danger" onclick="app.removeLine(${i})">🗑️</button>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div class="form-group">
            <label class="form-label">From bus</label>
            <select class="form-select line-from" data-idx="${i}" onchange="app.updateLine(${i},'from_bus',parseInt(this.value))">
              ${this.getBusOptions(line.from_bus)}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">To bus</label>
            <select class="form-select line-to" data-idx="${i}" onchange="app.updateLine(${i},'to_bus',parseInt(this.value))">
              ${this.getBusOptions(line.to_bus)}
            </select>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div class="form-group">
            <label class="form-label">Length (km)</label>
            <input type="number" step="0.01" class="form-input" value="${line.length_km}" onchange="app.updateLine(${i},'length_km',parseFloat(this.value))">
          </div>
          <div class="form-group">
            <label class="form-label">Standard type</label>
            <select class="form-select" onchange="app.updateLine(${i},'std_type',this.value)">
              ${STD_LINE_TYPES.map(t => `<option value="${t}" ${t === line.std_type ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group" style="display:flex;align-items:center;gap:8px;">
          <input type="checkbox" ${line.in_service ? 'checked' : ''} onchange="app.updateLine(${i},'in_service',this.checked)">
          <label class="form-label" style="margin:0;">In service</label>
        </div>
      `;
      container.appendChild(row);
    });
  },

  addLine() {
    const n = this.network.buses.length;
    if (n < 2) { alert('Need at least 2 buses'); return; }
    this.network.lines.push({ from_bus: 0, to_bus: n > 1 ? 1 : 0, length_km: 1.0, std_type: "NAYY 4x150 SE", in_service: true });
    this.renderLines();
  },

  removeLine(i) {
    this.network.lines.splice(i, 1);
    this.renderLines();
  },

  updateLine(i, field, value) {
    this.network.lines[i][field] = value;
  },

  renderLoads() {
    const container = document.getElementById('loads-container');
    container.innerHTML = '';
    this.network.loads.forEach((load, i) => {
      const row = document.createElement('div');
      row.className = 'element-row';
      row.innerHTML = `
        <div class="element-header">
          <span>Load ${i}</span>
          <div class="element-actions">
            <button class="btn btn-sm btn-danger" onclick="app.removeLoad(${i})">🗑️</button>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Name</label>
          <input type="text" class="form-input" value="${load.name}" onchange="app.updateLoad(${i},'name',this.value)">
        </div>
        <div class="form-group">
          <label class="form-label">Bus</label>
          <select class="form-select" onchange="app.updateLoad(${i},'bus_idx',parseInt(this.value))">
            ${this.getBusOptions(load.bus_idx)}
          </select>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div class="form-group">
            <label class="form-label">Active power P (MW)</label>
            <input type="number" step="0.001" class="form-input" value="${load.p_mw}" onchange="app.updateLoad(${i},'p_mw',parseFloat(this.value))">
          </div>
          <div class="form-group">
            <label class="form-label">Reactive power Q (MVAr)</label>
            <input type="number" step="0.001" class="form-input" value="${load.q_mvar}" onchange="app.updateLoad(${i},'q_mvar',parseFloat(this.value))">
          </div>
        </div>
        <div class="form-group" style="display:flex;align-items:center;gap:8px;">
          <input type="checkbox" ${load.in_service ? 'checked' : ''} onchange="app.updateLoad(${i},'in_service',this.checked)">
          <label class="form-label" style="margin:0;">In service</label>
        </div>
      `;
      container.appendChild(row);
    });
  },

  addLoad() {
    this.network.loads.push({ bus_idx: 0, p_mw: 0.1, q_mvar: 0.03, name: `Load ${this.network.loads.length}`, in_service: true });
    this.renderLoads();
  },

  removeLoad(i) {
    this.network.loads.splice(i, 1);
    this.renderLoads();
  },

  updateLoad(i, field, value) {
    this.network.loads[i][field] = value;
  },

  renderSgens() {
    const container = document.getElementById('sgens-container');
    container.innerHTML = '';
    this.network.sgens.forEach((sgen, i) => {
      const row = document.createElement('div');
      row.className = 'element-row';
      row.innerHTML = `
        <div class="element-header">
          <span>SGen ${i}</span>
          <div class="element-actions">
            <button class="btn btn-sm btn-danger" onclick="app.removeSgen(${i})">🗑️</button>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Name</label>
          <input type="text" class="form-input" value="${sgen.name}" onchange="app.updateSgen(${i},'name',this.value)">
        </div>
        <div class="form-group">
          <label class="form-label">Bus</label>
          <select class="form-select" onchange="app.updateSgen(${i},'bus_idx',parseInt(this.value))">
            ${this.getBusOptions(sgen.bus_idx)}
          </select>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div class="form-group">
            <label class="form-label">Active power P (MW)</label>
            <input type="number" step="0.001" class="form-input" value="${sgen.p_mw}" onchange="app.updateSgen(${i},'p_mw',parseFloat(this.value))">
          </div>
          <div class="form-group">
            <label class="form-label">Reactive power Q (MVAr)</label>
            <input type="number" step="0.001" class="form-input" value="${sgen.q_mvar}" onchange="app.updateSgen(${i},'q_mvar',parseFloat(this.value))">
          </div>
        </div>
        <div class="form-group" style="display:flex;align-items:center;gap:8px;">
          <input type="checkbox" ${sgen.in_service ? 'checked' : ''} onchange="app.updateSgen(${i},'in_service',this.checked)">
          <label class="form-label" style="margin:0;">In service</label>
        </div>
      `;
      container.appendChild(row);
    });
  },

  addSgen() {
    this.network.sgens.push({ bus_idx: 0, p_mw: 0.05, q_mvar: 0.0, name: `Solar ${this.network.sgens.length}`, in_service: true });
    this.renderSgens();
  },

  removeSgen(i) {
    this.network.sgens.splice(i, 1);
    this.renderSgens();
  },

  updateSgen(i, field, value) {
    this.network.sgens[i][field] = value;
  },

  renderTrafos() {
    const container = document.getElementById('trafos-container');
    container.innerHTML = '';
    this.network.trafos.forEach((trafo, i) => {
      const row = document.createElement('div');
      row.className = 'element-row';
      row.innerHTML = `
        <div class="element-header">
          <span>Transformer ${i}</span>
          <div class="element-actions">
            <button class="btn btn-sm btn-danger" onclick="app.removeTrafo(${i})">🗑️</button>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div class="form-group">
            <label class="form-label">HV bus</label>
            <select class="form-select" onchange="app.updateTrafo(${i},'hv_bus',parseInt(this.value))">
              ${this.getBusOptions(trafo.hv_bus)}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">LV bus</label>
            <select class="form-select" onchange="app.updateTrafo(${i},'lv_bus',parseInt(this.value))">
              ${this.getBusOptions(trafo.lv_bus)}
            </select>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:2fr 1fr;gap:10px;">
          <div class="form-group">
            <label class="form-label">Standard type</label>
            <select class="form-select" onchange="app.updateTrafo(${i},'std_type',this.value)">
              ${STD_TRAFO_TYPES.map(t => `<option value="${t}" ${t === trafo.std_type ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Tap position</label>
            <input type="number" step="1" class="form-input" value="${trafo.tap_pos}" onchange="app.updateTrafo(${i},'tap_pos',parseInt(this.value))">
          </div>
        </div>
        <div class="form-group" style="display:flex;align-items:center;gap:8px;">
          <input type="checkbox" ${trafo.in_service ? 'checked' : ''} onchange="app.updateTrafo(${i},'in_service',this.checked)">
          <label class="form-label" style="margin:0;">In service</label>
        </div>
      `;
      container.appendChild(row);
    });
  },

  addTrafo() {
    this.network.trafos.push({ hv_bus: 0, lv_bus: 1, std_type: "0.25 MVA 11/0.4 kV", tap_pos: 0, in_service: true });
    this.renderTrafos();
  },

  removeTrafo(i) {
    this.network.trafos.splice(i, 1);
    this.renderTrafos();
  },

  updateTrafo(i, field, value) {
    this.network.trafos[i][field] = value;
  },

  // ─── Helpers ───
  getBusOptions(selectedIdx) {
    return this.network.buses.map((b, i) =>
      `<option value="${i}" ${i === selectedIdx ? 'selected' : ''}>${i}: ${b.name} (${b.vn_kv} kV)</option>`
    ).join('');
  },

  updateBusOptions() {
    // Update ext_grid bus select
    const extSelect = document.getElementById('ext-bus');
    if (extSelect) {
      extSelect.innerHTML = this.getBusOptions(this.network.ext_grid.bus_idx);
      extSelect.onchange = (e) => { this.network.ext_grid.bus_idx = parseInt(e.target.value); };
    }
  },

  getNetworkConfig() {
    return {
      version: "1.0",
      name: "Custom Network",
      buses: this.network.buses,
      ext_grid: this.network.ext_grid,
      lines: this.network.lines,
      loads: this.network.loads,
      sgens: this.network.sgens,
      trafos: this.network.trafos,
      mode: this.currentMode
    };
  },

  // ─── Power Flow Execution ───
  async runPowerFlow() {
    if (!this.pyodideReady) {
      alert('Python runtime not ready yet. Please wait.');
      return;
    }

    const runBtn = document.getElementById('run-btn');
    runBtn.disabled = true;
    runBtn.textContent = '⏳ Running…';

    try {
      const pythonCode = this.generatePythonCode();
      const resultJson = await this.pyodide.runPythonAsync(pythonCode);
      const result = JSON.parse(resultJson);
      this.displayResults(result);
    } catch (err) {
      console.error('Power flow error:', err);
      alert('Power flow failed: ' + err.message);
    } finally {
      runBtn.disabled = false;
      runBtn.textContent = '▶ Run Power Flow';
    }
  },

  generatePythonCode() {
    const n = this.network;
    const busVars = n.buses.map((_, i) => `b${i}`).join(', ');

    let code = `
import pandapower as pp
import json

net = pp.create_empty_network()

# Buses
${n.buses.map((b, i) => `b${i} = pp.create_bus(net, vn_kv=${b.vn_kv}, name="${b.name}", in_service=${b.in_service})`).join('\n')}

# External Grid
pp.create_ext_grid(net, b${n.ext_grid.bus_idx}, vm_pu=${n.ext_grid.vm_pu})

# Lines
${n.lines.map(l => `pp.create_line(net, b${l.from_bus}, b${l.to_bus}, length_km=${l.length_km}, std_type="${l.std_type}", in_service=${l.in_service})`).join('\n')}

# Loads
${n.loads.map(l => `pp.create_load(net, b${l.bus_idx}, p_mw=${l.p_mw}, q_mvar=${l.q_mvar}, name="${l.name}", in_service=${l.in_service})`).join('\n')}

# Static Generators
${n.sgens.map(s => `pp.create_sgen(net, b${s.bus_idx}, p_mw=${s.p_mw}, q_mvar=${s.q_mvar}, name="${s.name}", in_service=${s.in_service})`).join('\n')}

# Transformers
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
    return code;
  },

  // ─── Results Display ───
  displayResults(result) {
    const section = document.getElementById('results-section');
    const content = document.getElementById('results-content');
    section.classList.remove('hidden');

    if (!result.converged) {
      content.innerHTML = `
        <div class="alert alert-danger">
          ❌ Power flow did not converge<br>
          <small>${result.error || 'Check network connectivity and loading levels.'}</small>
        </div>
      `;
      section.scrollIntoView({ behavior: 'smooth' });
      return;
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
    const maxLoadLine = lines.find(l => l.loading_percent === maxLineLoad);
    const maxLoadLineName = maxLoadLine ? `Line ${maxLoadLine.line_idx}` : 'N/A';

    // Determine overall status
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
        <div class="summary-card status-${minVm >= 0.95 ? 'pass' : minVm >= 0.90 ? 'warn' : 'fail'}">
          <div class="summary-label">Min Voltage</div>
          <div class="summary-value">${minVm.toFixed(3)} pu</div>
          <div class="summary-detail">${minVmBus}</div>
        </div>
        <div class="summary-card status-${maxVm <= 1.05 ? 'pass' : maxVm <= 1.10 ? 'warn' : 'fail'}">
          <div class="summary-label">Max Voltage</div>
          <div class="summary-value">${maxVm.toFixed(3)} pu</div>
          <div class="summary-detail">Highest bus</div>
        </div>
        <div class="summary-card status-${maxLineLoad <= 70 ? 'pass' : maxLineLoad <= 90 ? 'warn' : 'fail'}">
          <div class="summary-label">Max Line Load</div>
          <div class="summary-value">${maxLineLoad.toFixed(1)}%</div>
          <div class="summary-detail">${maxLoadLineName}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">Total Losses</div>
          <div class="summary-value">${(totalLosses * 1000).toFixed(1)} kW</div>
          <div class="summary-detail">Lines + Trafos</div>
        </div>
      </div>
    `;

    // Bus results table
    html += `<div class="section-header">Bus Results</div>`;
    html += `<div class="result-table-container"><table class="result-table"><thead><tr>
      <th>Bus</th><th>Name</th><th>Voltage (pu)</th><th>Angle (°)</th><th>P (MW)</th><th>Q (MVAr)</th><th>Status</th>
    </tr></thead><tbody>`;
    buses.forEach(b => {
      const vm = b.vm_pu;
      const status = vm >= 0.95 && vm <= 1.05 ? 'pass' : vm >= 0.90 && vm <= 1.10 ? 'warn' : 'fail';
      const statusLabel = status === 'pass' ? 'OK' : status === 'warn' ? 'Watch' : 'Violation';
      html += `<tr>
        <td>${b.bus_idx}</td>
        <td>${busNames[b.bus_idx] || `Bus ${b.bus_idx}`}</td>
        <td class="cell-${status === 'pass' ? 'green' : status === 'warn' ? 'amber' : 'red'}">${vm.toFixed(4)}</td>
        <td>${b.va_degree.toFixed(2)}</td>
        <td>${b.p_mw.toFixed(3)}</td>
        <td>${b.q_mvar.toFixed(3)}</td>
        <td class="cell-${status === 'pass' ? 'green' : status === 'warn' ? 'amber' : 'red'}">${statusLabel}</td>
      </tr>`;
    });
    html += `</tbody></table></div>`;

    // Line results table
    if (lines.length > 0) {
      html += `<div class="section-header">Line Results</div>`;
      html += `<div class="result-table-container"><table class="result-table"><thead><tr>
        <th>Line</th><th>P from (MW)</th><th>P to (MW)</th><th>Losses (kW)</th><th>Current (kA)</th><th>Loading (%)</th><th>Status</th>
      </tr></thead><tbody>`;
      lines.forEach(l => {
        const load = l.loading_percent;
        const status = load <= 70 ? 'pass' : load <= 90 ? 'warn' : 'fail';
        const statusLabel = status === 'pass' ? 'OK' : status === 'warn' ? 'Watch' : 'Overload';
        html += `<tr>
          <td>${l.line_idx}</td>
          <td>${l.p_from_mw.toFixed(3)}</td>
          <td>${l.p_to_mw.toFixed(3)}</td>
          <td>${(l.pl_mw * 1000).toFixed(1)}</td>
          <td>${l.i_from_ka.toFixed(3)}</td>
          <td class="cell-${status === 'pass' ? 'green' : status === 'warn' ? 'amber' : 'red'}">${load.toFixed(1)}%</td>
          <td class="cell-${status === 'pass' ? 'green' : status === 'warn' ? 'amber' : 'red'}">${statusLabel}</td>
        </tr>`;
      });
      html += `</tbody></table></div>`;
    }

    // Transformer results table
    if (trafos.length > 0) {
      html += `<div class="section-header">Transformer Results</div>`;
      html += `<div class="result-table-container"><table class="result-table"><thead><tr>
        <th>Trafo</th><th>P HV (MW)</th><th>P LV (MW)</th><th>Losses (kW)</th><th>Loading (%)</th><th>Status</th>
      </tr></thead><tbody>`;
      trafos.forEach(t => {
        const load = t.loading_percent;
        const status = load <= 70 ? 'pass' : load <= 90 ? 'warn' : 'fail';
        const statusLabel = status === 'pass' ? 'OK' : status === 'warn' ? 'Watch' : 'Overload';
        html += `<tr>
          <td>${t.trafo_idx}</td>
          <td>${t.p_hv_mw.toFixed(3)}</td>
          <td>${t.p_lv_mw.toFixed(3)}</td>
          <td>${(t.pl_mw * 1000).toFixed(1)}</td>
          <td class="cell-${status === 'pass' ? 'green' : status === 'warn' ? 'amber' : 'red'}">${load.toFixed(1)}%</td>
          <td class="cell-${status === 'pass' ? 'green' : status === 'warn' ? 'amber' : 'red'}">${statusLabel}</td>
        </tr>`;
      });
      html += `</tbody></table></div>`;
    }

    // Save/Export buttons
    html += `
      <div style="display:flex;gap:10px;padding:0 0 20px;">
        <button class="btn btn-secondary" onclick="app.saveJson()">💾 Save JSON</button>
        <button class="btn btn-secondary" onclick="app.loadJsonPrompt()">📂 Load JSON</button>
      </div>
    `;

    content.innerHTML = html;
    section.scrollIntoView({ behavior: 'smooth' });
  },

  hideResults() {
    document.getElementById('results-section').classList.add('hidden');
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
        try {
          const config = JSON.parse(ev.target.result);
          this.loadConfig(config);
        } catch (err) {
          alert('Invalid JSON file');
        }
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
    this.renderAll();
    this.hideResults();
  }
};

// ─── Boot ───
document.addEventListener('DOMContentLoaded', () => app.init());
