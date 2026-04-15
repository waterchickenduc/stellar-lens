/* overview.js — totals across all planets */

const BUILDING_ORDER = [
  ['operations_center',  'Operations Center'],
  ['research_lab',       'Laboratory'],
  ['shipyard',           'Shipyard'],
  ['ore_mine',           'Ore Mine'],
  ['crystal_mine',       'Crystal Mine'],
  ['helium3_extractor',  'Helium-3 Mine'],
  ['solar_plant',        'Solar Plant'],
  ['fusion_reactor',     'Fusion Reactor'],
  ['ore_storage',        'Metal Storage'],
  ['crystal_storage',    'Crystal Storage'],
  ['helium3_tank',       'Deut Storage'],
];

const DEFENSE_ORDER = [
  ['rocket_launcher','Rocket Launcher'],['light_laser','Light Laser'],
  ['heavy_laser','Heavy Laser'],['gauss_cannon','Gauss Cannon'],
  ['ion_cannon','Ion Cannon'],['plasma_turret','Plasma Turret'],
  ['small_shield','Small Shield Dome'],['large_shield','Large Shield Dome'],
  ['abm','Anti-Ballistic Missile'],['ipm','Interplanetary Missile'],
];

const SHIP_ORDER = [
  ['light_fighter','Light Fighter'],['heavy_fighter','Heavy Fighter'],
  ['probe','Probe'],['small_cargo','Small Cargo'],['large_cargo','Large Cargo'],
  ['cruiser','Cruiser'],['bomber','Bomber'],['recycler','Recycler'],
  ['colony_ship','Colony Ship'],['battleship','Battleship'],
  ['destroyer','Destroyer'],['battlecruiser','Battlecruiser'],['leviathan','Leviathan'],
];

let _ovChart = null;

async function renderOverview(d) {
  const el = document.getElementById('panel-overview');
  if (!el) return;

  let totalOre=0, totalCrystal=0, totalHelium=0;
  (d.coloniesData||[]).forEach(col => {
    totalOre     += col.production?.ore     || 0;
    totalCrystal += col.production?.crystal || 0;
    totalHelium  += col.production?.helium3 || 0;
  });

  const cols = d.coloniesData || [];

  el.innerHTML = `
    <div class="section-heading">Total Production / hour</div>
    <div style="display:flex;gap:1rem;align-items:stretch;margin-bottom:1.5rem;flex-wrap:wrap">
      <div style="display:flex;flex-direction:column;gap:0.75rem;flex-shrink:0">
        <div class="stat-card">
          <div class="stat-card-label">⛏ Ore</div>
          <div class="stat-card-value">${fmtNum(totalOre)}</div>
          <div class="stat-card-sub">across ${cols.length} planets</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-label">◆ Crystal</div>
          <div class="stat-card-value">${fmtNum(totalCrystal)}</div>
          <div class="stat-card-sub">across ${cols.length} planets</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-label">⚛ Helium-3</div>
          <div class="stat-card-value">${fmtNum(totalHelium)}</div>
          <div class="stat-card-sub">across ${cols.length} planets</div>
        </div>
      </div>
      <div style="flex:1;min-width:260px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:1rem;display:flex;flex-direction:column">
        <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:0.5rem" id="ov-chart-label">Production trend</div>
        <div style="flex:1;position:relative;min-height:140px">
          <canvas id="ov-prod-chart"></canvas>
        </div>
      </div>
    </div>

    <div class="section-heading">Buildings per Planet</div>
    ${perPlanetTable(cols, BUILDING_ORDER, 'buildings', 'Building', 'avg')}

    <div class="section-heading">Defenses per Planet</div>
    ${perPlanetTable(cols, DEFENSE_ORDER, 'defenses', 'Defense', 'avg')}

    <div class="section-heading">Fleet Distribution per Planet</div>
    ${perPlanetTable(cols, SHIP_ORDER, 'ships', 'Ship', 'avg')}
  `;

  // Async: fetch history — reversed so oldest is left, newest is right
  try {
    const res = await apiFetch(`/api/accounts/${Dash.currentAccountId}/history?limit=96`);
    const history = (res.history || []).reverse();
    if (history.length < 2) return;

    const lbl = document.getElementById('ov-chart-label');
    if (lbl) lbl.textContent = `Production trend · last ${history.length} snapshots`;

    const labels = history.map(h => {
      const dd = new Date(h.fetched_at);
      return dd.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
    });

    if (_ovChart) { _ovChart.destroy(); _ovChart = null; }
    const ctx = document.getElementById('ov-prod-chart');
    if (!ctx) return;

    _ovChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label:'Ore',     data:history.map(h=>h.production?.ore),     borderColor:'#c49a3c', backgroundColor:'#c49a3c18', borderWidth:1.5, pointRadius:0, tension:0.3, fill:false },
          { label:'Crystal', data:history.map(h=>h.production?.crystal), borderColor:'#4f98a3', backgroundColor:'#4f98a318', borderWidth:1.5, pointRadius:0, tension:0.3, fill:false },
          { label:'Helium',  data:history.map(h=>h.production?.helium3), borderColor:'#9fd0d8', backgroundColor:'#9fd0d818', borderWidth:1.5, pointRadius:0, tension:0.3, fill:false },
        ],
      },
      options: {
        responsive:true, maintainAspectRatio:false,
        interaction:{ mode:'index', intersect:false },
        plugins:{
          legend:{ labels:{ color:'#7a7975', boxWidth:8, font:{size:9}, padding:4 } },
          tooltip:{
            backgroundColor:'#1c1b19', borderColor:'#2e2d2a', borderWidth:1,
            titleColor:'#cdccca', bodyColor:'#9fd0d8',
            callbacks:{ label: ctx => ` ${ctx.dataset.label}: ${fmtNum(ctx.parsed.y)}/hr` },
          },
        },
        scales:{
          x:{ ticks:{ color:'#7a7975', maxTicksLimit:6, font:{size:9} }, grid:{ color:'#2e2d2a' } },
          y:{ ticks:{ color:'#7a7975', font:{size:9}, callback:v=>fmtNum(v) }, grid:{ color:'#2e2d2a' } },
        },
      },
    });
  } catch(e) { /* chart not critical */ }
}

function perPlanetTable(cols, order, field, rowHeader, summaryMode) {
  const header = cols.map((c,i) =>
    `<th class="num">P${i+1}<br><span class="dim" style="font-size:0.65rem">${escHtml(c.name)}</span></th>`
  ).join('');
  const summaryLabel = summaryMode==='avg' ? 'Avg' : 'Total';
  const rows = order.map(([key,label]) => {
    let total=0;
    const cells = cols.map(c => {
      const v = c[field]?.[key];
      total += v||0;
      return `<td class="num">${v!=null && v>0 ? v.toLocaleString() : '—'}</td>`;
    }).join('');
    if (total === 0) return '';
    const summary = summaryMode==='avg' ? (cols.length ? Math.round(total/cols.length) : 0) : total;
    const summaryCell = summary>0
      ? `<td class="num" style="color:var(--accent);font-weight:600">${summary.toLocaleString()}</td>`
      : `<td class="num dim">—</td>`;
    return `<tr><td>${label}</td>${cells}${summaryCell}</tr>`;
  }).filter(Boolean).join('');
  return `<div class="data-table-wrap"><table class="data-table">
    <thead><tr><th>${rowHeader}</th>${header}<th class="num" style="color:var(--accent)">${summaryLabel}</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
