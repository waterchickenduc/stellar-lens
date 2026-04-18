/* frontend/js/dashboard/overview.js — totals across all planets */

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

/* ── Storage / alert helpers ─────────────────────────────── */

function _posType(pos) {
  if (!pos) return null;
  const m = pos.match(/\[([A-Z]+)-/);
  if (!m) return null;
  const t = { FRO:'Frontier', COL:'Colony', PIR:'Pirate', IMP:'Imperium', CON:'Consortium' };
  return t[m[1]] || m[1];
}

function _storAlertColor(hrs) {
  if (!isFinite(hrs) || hrs < 0) return 'var(--text-muted)';
  if (hrs < 2)  return '#c0575a';  // red  — fills in < 2 h
  if (hrs < 12) return '#c49a3c';  // amber — fills in < 12 h
  return '#4fa36e';                 // green — plenty of time
}

function _fmtTime(hrs) {
  if (!isFinite(hrs) || hrs < 0) return null;
  if (hrs < 1)  return `${Math.round(hrs * 60)}m`;
  if (hrs < 24) return `${hrs.toFixed(1)}h`;
  const d = Math.floor(hrs / 24);
  const h = Math.round(hrs % 24);
  return h > 0 ? `${d}d ${h}h` : `${d}d`;
}

/*
 * Renders a thin progress bar + "XX.X% full  Xh" line.
 * pct    — aggregate fill percentage (0–100)
 * minHrs — soonest any single planet overflows for this resource
 */
function _storageBar(pct, minHrs) {
  const color   = _storAlertColor(minHrs);
  const timeStr = _fmtTime(minHrs);
  return `
    <div class="stor-bar-track" style="margin-top:0.55rem">
      <div class="stor-bar-fill" style="width:${pct.toFixed(1)}%;background:${color}"></div>
    </div>
    <div class="stor-bar-meta">
      <span>${pct.toFixed(1)}% full</span>
      ${timeStr ? `<span style="color:${color};font-weight:600">${timeStr}</span>` : ''}
    </div>`;
}

/* ── Planet summary grid ─────────────────────────────────── */

function _planetSummaryCards(cols) {
  const BADGE_COLORS = {
    Frontier:'#4f98a3', Colony:'#4fa36e', Pirate:'#c0575a',
    Imperium:'#9f7fd4', Consortium:'#c49a3c',
  };

  return cols.map(col => {
    const ore  = col.production?.ore     || 0;
    const crys = col.production?.crystal || 0;
    const hel  = col.production?.helium3 || 0;
    const s    = col.storage;
    const type = _posType(col.position);
    const bc   = type ? (BADGE_COLORS[type] || 'var(--text-muted)') : null;

    const storRows = s ? [
      { label:'Ore',     amt: s.ore?.amount||0,    cap: s.ore?.capacity||0,    prod: ore  },
      { label:'Crystal', amt: s.crystal?.amount||0, cap: s.crystal?.capacity||0, prod: crys },
      { label:'Helium',  amt: s.helium3?.amount||0, cap: s.helium3?.capacity||0, prod: hel  },
    ].filter(r => r.cap > 0).map(r => {
      const pct    = Math.min(100, (r.amt / r.cap) * 100);
      const rem    = Math.max(0, r.cap - r.amt);
      const hrs    = r.prod > 0 ? rem / r.prod : Infinity;
      const color  = _storAlertColor(hrs);
      const tStr   = _fmtTime(hrs);
      return `
        <div class="ps-stor-row">
          <span class="ps-stor-label">${r.label}</span>
          <div class="stor-bar-track" style="flex:1;min-width:36px">
            <div class="stor-bar-fill" style="width:${pct.toFixed(1)}%;background:${color}"></div>
          </div>
          <span class="ps-stor-pct" style="color:${color}">${Math.round(pct)}%</span>
          ${tStr ? `<span class="ps-stor-time" style="color:${color}">${tStr}</span>` : ''}
        </div>`;
    }).join('') : '';

    return `
      <div class="planet-summary-card">
        <div class="ps-header">
          <span class="ps-name">${escHtml(col.name)}</span>
          ${bc ? `<span class="ps-badge" style="background:${bc}22;color:${bc};border:1px solid ${bc}44">${type}</span>` : ''}
        </div>
        <div class="ps-prod">
          <span>⛏ ${fmtNum(ore)}</span>
          <span>◆ ${fmtNum(crys)}</span>
          <span>⚛ ${fmtNum(hel)}</span>
        </div>
        ${s && storRows ? `<div class="ps-stor-rows">${storRows}</div>` : ''}
      </div>`;
  }).join('');
}

/* ── Main render ─────────────────────────────────────────── */

async function renderOverview(d) {
  const el = document.getElementById('panel-overview');
  if (!el) return;

  const cols = d.coloniesData || [];

  // Totals
  let totalOre=0, totalCrystal=0, totalHelium=0;

  // Storage aggregates (sum across planets that have storage data)
  let sOreAmt=0,  sOreCap=0;
  let sCrysAmt=0, sCrysCap=0;
  let sHelAmt=0,  sHelCap=0;

  // Minimum hours until any single planet overflows — drives alert color
  let minOreHrs=Infinity, minCrysHrs=Infinity, minHelHrs=Infinity;

  cols.forEach(col => {
    const ore  = col.production?.ore     || 0;
    const crys = col.production?.crystal || 0;
    const hel  = col.production?.helium3 || 0;
    totalOre     += ore;
    totalCrystal += crys;
    totalHelium  += hel;

    const s = col.storage;
    if (s) {
      if (s.ore?.capacity) {
        const amt = s.ore.amount || 0;
        const cap = s.ore.capacity;
        sOreAmt += amt; sOreCap += cap;
        const hrs = ore > 0 ? Math.max(0, cap - amt) / ore : Infinity;
        minOreHrs = Math.min(minOreHrs, hrs);
      }
      if (s.crystal?.capacity) {
        const amt = s.crystal.amount || 0;
        const cap = s.crystal.capacity;
        sCrysAmt += amt; sCrysCap += cap;
        const hrs = crys > 0 ? Math.max(0, cap - amt) / crys : Infinity;
        minCrysHrs = Math.min(minCrysHrs, hrs);
      }
      if (s.helium3?.capacity) {
        const amt = s.helium3.amount || 0;
        const cap = s.helium3.capacity;
        sHelAmt += amt; sHelCap += cap;
        const hrs = hel > 0 ? Math.max(0, cap - amt) / hel : Infinity;
        minHelHrs = Math.min(minHelHrs, hrs);
      }
    }
  });

  // Aggregate fill percentages
  const orePct  = sOreCap  > 0 ? Math.min(100, (sOreAmt  / sOreCap)  * 100) : null;
  const crysPct = sCrysCap > 0 ? Math.min(100, (sCrysAmt / sCrysCap) * 100) : null;
  const helPct  = sHelCap  > 0 ? Math.min(100, (sHelAmt  / sHelCap)  * 100) : null;

  el.innerHTML = `
    <div class="section-heading">Total Production / hour</div>
    <div style="display:flex;gap:1rem;align-items:stretch;margin-bottom:1.5rem;flex-wrap:wrap">
      <div style="display:flex;flex-direction:column;gap:0.75rem;flex-shrink:0">
        <div class="stat-card">
          <div class="stat-card-label">⛏ Ore</div>
          <div class="stat-card-value">${fmtNum(totalOre)}</div>
          <div class="stat-card-sub">across ${cols.length} planets</div>
          ${orePct !== null ? _storageBar(orePct, minOreHrs) : ''}
        </div>
        <div class="stat-card">
          <div class="stat-card-label">◆ Crystal</div>
          <div class="stat-card-value">${fmtNum(totalCrystal)}</div>
          <div class="stat-card-sub">across ${cols.length} planets</div>
          ${crysPct !== null ? _storageBar(crysPct, minCrysHrs) : ''}
        </div>
        <div class="stat-card">
          <div class="stat-card-label">⚛ Helium-3</div>
          <div class="stat-card-value">${fmtNum(totalHelium)}</div>
          <div class="stat-card-sub">across ${cols.length} planets</div>
          ${helPct !== null ? _storageBar(helPct, minHelHrs) : ''}
        </div>
      </div>
      <div style="flex:1;min-width:260px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:1rem;display:flex;flex-direction:column">
        <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:0.5rem" id="ov-chart-label">Production trend</div>
        <div style="flex:1;position:relative;min-height:140px">
          <canvas id="ov-prod-chart"></canvas>
        </div>
      </div>
    </div>

    <div class="section-heading">Planet Overview</div>
    <div class="planet-summary-grid" style="margin-bottom:1.5rem">
      ${_planetSummaryCards(cols)}
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

/* ── Unchanged helpers ───────────────────────────────────── */

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