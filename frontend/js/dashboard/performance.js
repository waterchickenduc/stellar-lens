/* performance.js — visual fleet, defense, production charts */

const _charts = {};

function destroyChart(id) {
  if (_charts[id]) { _charts[id].destroy(); delete _charts[id]; }
}

// 13 visually distinct colors — prefixed to avoid conflict with planet.js PALETTE
const PERF_PALETTE = [
  '#4f98a3','#c49a3c','#c0575a','#4fa36e','#9f7fd4',
  '#d4a574','#5a8fc0','#a3c44f','#c47a3c','#3ca4c4',
  '#e07b54','#7bc47b','#c45a9f',
];

async function renderPerformance() {
  const el = document.getElementById('panel-performance');
  if (!el) return;

  const d = Dash.snapshot;
  if (!d) { el.innerHTML = '<div class="tab-loading">No data.</div>'; return; }

  const cols = d.coloniesData || [];

  const fleet = {}, defs = {};
  cols.forEach(col => {
    Object.entries(col.ships    || {}).forEach(([k,v]) => { fleet[k] = (fleet[k]||0)+v; });
    Object.entries(col.defenses || {}).forEach(([k,v]) => { defs[k]  = (defs[k] ||0)+v; });
  });

  const SHIP_NAMES = {
    light_fighter:'Light Fighter',heavy_fighter:'Heavy Fighter',probe:'Probe',
    small_cargo:'Small Cargo',large_cargo:'Large Cargo',cruiser:'Cruiser',
    bomber:'Bomber',recycler:'Recycler',colony_ship:'Colony Ship',
    battleship:'Battleship',destroyer:'Destroyer',battlecruiser:'Battlecruiser',
    leviathan:'Leviathan',
  };
  const DEF_NAMES = {
    rocket_launcher:'Rocket Launcher',light_laser:'Light Laser',
    heavy_laser:'Heavy Laser',gauss_cannon:'Gauss Cannon',
    ion_cannon:'Ion Cannon',plasma_turret:'Plasma Turret',
    small_shield:'Small Shield',large_shield:'Large Shield',
    abm:'ABM',ipm:'IPM',
  };

  const fleetEntries = Object.entries(fleet).filter(([,v])=>v>0);
  const defEntries   = Object.entries(defs).filter(([,v])=>v>0);
  const planetNames  = cols.map(c => c.name);

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;margin-bottom:1.5rem">
      <div class="perf-chart-wrap">
        <div style="font-size:0.9rem;font-weight:600;color:var(--text);margin-bottom:1rem">Fleet Composition</div>
        <div style="display:flex;gap:1.5rem;align-items:flex-start">
          <div style="flex-shrink:0;width:200px;height:200px;position:relative">
            <canvas id="chart-fleet-pie"></canvas>
          </div>
          <div id="fleet-legend" style="flex:1;overflow:auto"></div>
        </div>
      </div>
      <div class="perf-chart-wrap">
        <div style="font-size:0.9rem;font-weight:600;color:var(--text);margin-bottom:1rem">Defense Composition</div>
        <div style="display:flex;gap:1.5rem;align-items:flex-start">
          <div style="flex-shrink:0;width:200px;height:200px;position:relative">
            <canvas id="chart-def-pie"></canvas>
          </div>
          <div id="def-legend" style="flex:1;overflow:auto"></div>
        </div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1rem;margin-bottom:1.5rem">
      <div class="perf-chart-wrap" style="max-height:220px">
        <div style="font-size:0.9rem;font-weight:600;color:var(--text);margin-bottom:0.75rem">⛏ Ore per Planet</div>
        <canvas id="chart-ore-bar"></canvas>
      </div>
      <div class="perf-chart-wrap" style="max-height:220px">
        <div style="font-size:0.9rem;font-weight:600;color:var(--text);margin-bottom:0.75rem">◆ Crystal per Planet</div>
        <canvas id="chart-crystal-bar"></canvas>
      </div>
      <div class="perf-chart-wrap" style="max-height:220px">
        <div style="font-size:0.9rem;font-weight:600;color:var(--text);margin-bottom:0.75rem">⚛ Helium per Planet</div>
        <canvas id="chart-helium-bar"></canvas>
      </div>
    </div>
    <div class="perf-chart-wrap" style="max-height:220px">
      <div style="font-size:0.9rem;font-weight:600;color:var(--text);margin-bottom:0.75rem" id="prod-history-label">
        Production / hour Over Time
      </div>
      <canvas id="chart-production"></canvas>
    </div>
  `;

  requestAnimationFrame(() => {
    if (fleetEntries.length) {
      destroyChart('fleet-pie');
      const total = fleetEntries.reduce((s,[,v])=>s+v,0);
      _charts['fleet-pie'] = new Chart(document.getElementById('chart-fleet-pie'), {
        type: 'doughnut',
        data: {
          labels: fleetEntries.map(([k]) => SHIP_NAMES[k]||k),
          datasets: [{ data: fleetEntries.map(([,v])=>v), backgroundColor: PERF_PALETTE, borderWidth: 2, borderColor: '#1c1b19' }],
        },
        options: doughnutOptions(),
      });
      renderPieLegend('fleet-legend', fleetEntries.map(([k,v],i) => ({
        label: SHIP_NAMES[k]||k, value: v, color: PERF_PALETTE[i % PERF_PALETTE.length], total,
      })));
    }

    if (defEntries.length) {
      destroyChart('def-pie');
      const total = defEntries.reduce((s,[,v])=>s+v,0);
      _charts['def-pie'] = new Chart(document.getElementById('chart-def-pie'), {
        type: 'doughnut',
        data: {
          labels: defEntries.map(([k]) => DEF_NAMES[k]||k),
          datasets: [{ data: defEntries.map(([,v])=>v), backgroundColor: PERF_PALETTE, borderWidth: 2, borderColor: '#1c1b19' }],
        },
        options: doughnutOptions(),
      });
      renderPieLegend('def-legend', defEntries.map(([k,v],i) => ({
        label: DEF_NAMES[k]||k, value: v, color: PERF_PALETTE[i % PERF_PALETTE.length], total,
      })));
    }

    drawBarChart('chart-ore-bar',     'ore-bar',     planetNames, cols.map(c=>c.production?.ore||0),     '#c49a3c');
    drawBarChart('chart-crystal-bar', 'crystal-bar', planetNames, cols.map(c=>c.production?.crystal||0), '#4f98a3');
    drawBarChart('chart-helium-bar',  'helium-bar',  planetNames, cols.map(c=>c.production?.helium3||0), '#9fd0d8');
  });

  // Async: fetch history — reversed so oldest is left, newest is right
  try {
    const res = await apiFetch(`/api/accounts/${Dash.currentAccountId}/history?limit=200`);
    const history = (res.history || []).reverse();
    if (history.length >= 2) {
      const labels = history.map(h => fmtChartTime(h.fetched_at));
      const lbl = document.getElementById('prod-history-label');
      if (lbl) lbl.textContent = `Production / hour Over Time · ${history.length} snapshots`;
      destroyChart('production');
      const ctx = document.getElementById('chart-production');
      if (ctx) {
        _charts['production'] = new Chart(ctx, {
          type: 'line',
          data: {
            labels,
            datasets: [
              mkDataset('⛏ Ore',     history.map(h=>h.production?.ore),     '#c49a3c'),
              mkDataset('◆ Crystal', history.map(h=>h.production?.crystal), '#4f98a3'),
              mkDataset('⚛ Helium',  history.map(h=>h.production?.helium3), '#9fd0d8'),
            ],
          },
          options: chartOptions({ yFormatter: v => fmtNum(v) }),
        });
      }
    }
  } catch(e) { /* history not critical */ }
}

// Renders a custom HTML legend table with color swatch, label, count, percentage
function renderPieLegend(containerId, items) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const sorted = [...items].sort((a,b) => b.value - a.value);
  el.innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:0.78rem">
      <thead>
        <tr>
          <th style="text-align:left;color:var(--text-muted);padding:0 0.5rem 0.4rem 0;font-weight:500">Unit</th>
          <th style="text-align:right;color:var(--text-muted);padding:0 0.5rem 0.4rem;font-weight:500">Count</th>
          <th style="text-align:right;color:var(--text-muted);padding:0 0 0.4rem 0.5rem;font-weight:500">%</th>
        </tr>
      </thead>
      <tbody>
        ${sorted.map(item => {
          const pct = ((item.value / item.total) * 100).toFixed(1);
          return `<tr>
            <td style="padding:0.25rem 0.5rem 0.25rem 0;color:var(--text)">
              <span style="display:inline-flex;align-items:center;gap:0.4rem">
                <span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${item.color};flex-shrink:0"></span>
                ${item.label}
              </span>
            </td>
            <td style="padding:0.25rem 0.5rem;text-align:right;color:var(--text);font-variant-numeric:tabular-nums">${item.value.toLocaleString()}</td>
            <td style="padding:0.25rem 0 0.25rem 0.5rem;text-align:right;color:var(--text-muted)">${pct}%</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  `;
}

function drawBarChart(canvasId, chartId, labels, data, color) {
  destroyChart(chartId);
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  _charts[chartId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: color + 'cc',
        borderColor:     color,
        borderWidth:     1,
        borderRadius:    3,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1c1b19', borderColor: '#2e2d2a', borderWidth: 1,
          titleColor: '#cdccca', bodyColor: '#9fd0d8',
          callbacks: { label: ctx => ` ${fmtNum(ctx.parsed.y)}/hr` },
        },
      },
      scales: {
        x: { ticks: { color: '#7a7975', font: { size: 9 } }, grid: { display: false } },
        y: { ticks: { color: '#7a7975', font: { size: 9 }, callback: v => fmtNum(v) }, grid: { color: '#2e2d2a' } },
      },
    },
  });
}

function doughnutOptions() {
  return {
    responsive: true,
    maintainAspectRatio: true,
    cutout: '65%',
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1c1b19', borderColor: '#2e2d2a', borderWidth: 1,
        titleColor: '#cdccca', bodyColor: '#9fd0d8',
        callbacks: {
          label: ctx => {
            const total = ctx.dataset.data.reduce((a,b)=>a+b,0);
            const pct   = ((ctx.parsed / total) * 100).toFixed(1);
            return ` ${ctx.label}: ${ctx.parsed.toLocaleString()} (${pct}%)`;
          },
        },
      },
    },
  };
}

function mkDataset(label, data, color) {
  return {
    label, data,
    borderColor:      color,
    backgroundColor:  color + '18',
    borderWidth:      2,
    pointRadius:      data.length > 100 ? 0 : 2,
    pointHoverRadius: 4,
    tension:          0.3,
    fill:             false,
  };
}

function chartOptions({ yFormatter = v => v } = {}) {
  return {
    responsive: true,
    maintainAspectRatio: true,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { labels: { color: '#7a7975', boxWidth: 12, font: { size: 11 } } },
      tooltip: {
        backgroundColor: '#1c1b19', borderColor: '#2e2d2a', borderWidth: 1,
        titleColor: '#cdccca', bodyColor: '#9fd0d8',
        callbacks: { label: ctx => ` ${ctx.dataset.label}: ${yFormatter(ctx.parsed.y)}` },
      },
    },
    scales: {
      x: { ticks: { color: '#7a7975', maxTicksLimit: 10, font: { size: 10 } }, grid: { color: '#2e2d2a' } },
      y: { ticks: { color: '#7a7975', font: { size: 10 }, callback: yFormatter }, grid: { color: '#2e2d2a' } },
    },
  };
}

function fmtChartTime(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day:'2-digit', month:'short' })
    + ' ' + d.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' });
}
