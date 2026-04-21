/* frontend/js/dashboard/planet.js */

let _selectedPlanet = 0;
const _pCharts = {};
function destroyPChart(id) {
  if (_pCharts[id]) { _pCharts[id].destroy(); delete _pCharts[id]; }
}

const BUILDING_GROUPS = [
  { label:'Infrastructure', items:[
    ['operations_center','Operations Center',null],
    ['research_lab','Laboratory',null],
    ['shipyard','Shipyard',null],
  ]},
  { label:'Mines', items:[
    ['ore_mine','Ore Mine',null],
    ['crystal_mine','Crystal Mine',null],
    ['helium3_extractor','Helium-3 Mine',null],
  ]},
  { label:'Energy', items:[
    ['solar_plant','Solar Plant',null],
    ['fusion_reactor','Fusion Reactor',null],
  ]},
  { label:'Storage', items:[
    ['ore_storage','Metal Storage',30],
    ['crystal_storage','Crystal Storage',30],
    ['helium3_tank','Deut Storage',30],
  ]},
];

const P_DEFENSE_ORDER = [
  ['rocket_launcher','Rocket Launcher'],['light_laser','Light Laser'],
  ['heavy_laser','Heavy Laser'],['gauss_cannon','Gauss Cannon'],
  ['ion_cannon','Ion Cannon'],['plasma_turret','Plasma Turret'],
  ['small_shield','Small Shield Dome'],['large_shield','Large Shield Dome'],
  ['abm','Anti-Ballistic Missile'],['ipm','Interplanetary Missile'],
];

const P_SHIP_ORDER = [
  ['light_fighter','Light Fighter'],['heavy_fighter','Heavy Fighter'],
  ['probe','Probe'],['small_cargo','Small Cargo'],['large_cargo','Large Cargo'],
  ['cruiser','Cruiser'],['bomber','Bomber'],['recycler','Recycler'],
  ['colony_ship','Colony Ship'],['battleship','Battleship'],
  ['destroyer','Destroyer'],['battlecruiser','Battlecruiser'],['leviathan','Leviathan'],
];

const PALETTE = [
  '#4f98a3','#4fa36e','#c49a3c','#c0575a','#9fd0d8',
  '#9f7fd4','#d4a574','#5a8fc0','#a3c44f','#c47a3c','#3ca4c4','#7a7975',
];

function parsePosition(pos) {
  if (!pos) return null;
  const m = pos.match(/\[([A-Z]+)-(\d+):(\d+)\]/);
  if (!m) return null;
  const typeMap = { FRO:'Frontier', COL:'Colony', PIR:'Pirate', IMP:'Imperium', CON:'Consortium' };
  return { raw:pos, type:typeMap[m[1]]||m[1], system:m[2], slot:m[3] };
}

function systemBadgeColor(type) {
  return { Frontier:'#4f98a3', Colony:'#4fa36e', Pirate:'#c0575a', Imperium:'#9f7fd4', Consortium:'#c49a3c' }[type] || 'var(--text-muted)';
}

/* ── Storage section for planet detail ───────────────────── */

function _pStorageSection(storOre, storCrys, storHel, ore, crys, hel) {
  const rows = [
    { label:'Ore',      icon:'⛏', stor:storOre,  prod:ore  },
    { label:'Crystal',  icon:'◆', stor:storCrys, prod:crys },
    { label:'Helium-3', icon:'⚛', stor:storHel,  prod:hel  },
  ].filter(r => r.stor?.capacity).map(r => {
    const amt      = r.stor.amount || 0;
    const cap      = r.stor.capacity;
    const fillPct  = Math.min(100, (amt / cap) * 100);
    const hrs      = r.prod > 0 ? Math.max(0, cap - amt) / r.prod : Infinity;
    const color    = _storAlertColor(hrs);
    const tStr     = _fmtTime(hrs);
    return `<tr>
      <td>${r.icon} ${r.label}</td>
      <td class="num">${amt.toLocaleString()}</td>
      <td class="num">${cap.toLocaleString()}</td>
      <td class="num" style="color:${color};font-weight:600">${fillPct.toFixed(1)}%</td>
      <td class="num" style="color:${color};font-weight:600">${tStr || '—'}</td>
    </tr>`;
  }).join('');

  if (!rows) return '';
  return `
    <div class="section-heading">Storage</div>
    <div class="data-table-wrap" style="margin-bottom:1.5rem">
      <table class="data-table">
        <thead><tr>
          <th>Resource</th>
          <th class="num">Stored</th>
          <th class="num">Capacity</th>
          <th class="num">% Full</th>
          <th class="num">Time to Full</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

/* ── Main render ─────────────────────────────────────────── */

function renderPlanet(d) {
  const el = document.getElementById('panel-planet');
  if (!el) return;
  const cols = d.coloniesData || [];
  if (!cols.length) { el.innerHTML = '<div class="tab-loading">No colony data.</div>'; return; }
  if (_selectedPlanet >= cols.length) _selectedPlanet = 0;

  let empireOre=0, empireCrystal=0, empireHelium=0;
  cols.forEach(c => {
    empireOre     += c.production?.ore     || 0;
    empireCrystal += c.production?.crystal || 0;
    empireHelium  += c.production?.helium3 || 0;
  });

  const planetTabs = cols.map((c,i) => `
    <button onclick="_selectedPlanet=${i};renderPlanet(Dash.snapshot)"
            style="background:${i===_selectedPlanet?'var(--primary)':'transparent'};color:${i===_selectedPlanet?'#fff':'var(--text-muted)'};border:1px solid ${i===_selectedPlanet?'var(--primary)':'var(--border)'};border-radius:99px;padding:0.22rem 0.85rem;font-size:0.8rem;cursor:pointer;white-space:nowrap;font-family:inherit;transition:all 0.15s">
      ${escHtml(c.name)}
    </button>`).join('');

  const col = cols[_selectedPlanet];
  const pos = parsePosition(col.position);
  const ore  = col.production?.ore     || 0;
  const crys = col.production?.crystal || 0;
  const hel  = col.production?.helium3 || 0;
  const pct  = (v,t) => t>0 ? ((v/t)*100).toFixed(1) : '0.0';

  const storOre  = col.storage?.ore;
  const storCrys = col.storage?.crystal;
  const storHel  = col.storage?.helium3;

  const _ps = (stor, prod) => {
    if (!stor?.capacity) return '';
    const fillPct = Math.min(100, ((stor.amount || 0) / stor.capacity) * 100);
    const hrs = prod > 0 ? Math.max(0, stor.capacity - (stor.amount || 0)) / prod : Infinity;
    return _storageBar(fillPct, hrs);
  };

  const CATEGORY_COLORS = {
    'Infrastructure': '#4f98a3',
    'Mines':          '#4fa36e',
    'Energy':         '#c49a3c',
    'Storage':        '#9f7fd4',
  };
  const allBuildings = BUILDING_GROUPS.flatMap(g => g.items.map(item => ({ ...item, _cat: g.label })));
  const buildingLabels = allBuildings.map(b => b[1]);
  const buildingValues = allBuildings.map(b => col.buildings?.[b[0]] || 0);
  const buildingColors = allBuildings.map(b => CATEGORY_COLORS[b._cat] || '#7a7975');

  const defEntries  = P_DEFENSE_ORDER.filter(([k]) => (col.defenses?.[k]||0)>0);
  const shipEntries = P_SHIP_ORDER.filter(([k])    => (col.ships?.[k]||0)>0);

  el.innerHTML = `
    <!-- Planet tabs -->
    <div style="display:flex;flex-wrap:wrap;gap:0.4rem;margin-bottom:1.5rem">
      ${planetTabs}
    </div>

    <!-- Planet header -->
    <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:1.5rem;flex-wrap:wrap">
      <span style="color:var(--accent);font-weight:600;font-size:1.1rem">${escHtml(col.name)}</span>
      ${pos ? `
        <span style="font-size:0.72rem;padding:0.2rem 0.6rem;border-radius:99px;background:${systemBadgeColor(pos.type)}22;color:${systemBadgeColor(pos.type)};border:1px solid ${systemBadgeColor(pos.type)}44;font-weight:600;letter-spacing:0.04em">${pos.type}</span>
        <span style="font-size:0.8rem;color:var(--text-muted)">${pos.raw}</span>` : ''}
    </div>

    <!-- Production -->
    <div class="section-heading">Production / hour</div>
    <div class="stat-cards">
      <div class="stat-card">
        <div class="stat-card-label">⛏ Ore</div>
        <div class="stat-card-value">${fmtNum(ore)}</div>
        <div class="stat-card-sub">${pct(ore,empireOre)}% of empire</div>
        ${_ps(storOre, ore)}
      </div>
      <div class="stat-card">
        <div class="stat-card-label">◆ Crystal</div>
        <div class="stat-card-value">${fmtNum(crys)}</div>
        <div class="stat-card-sub">${pct(crys,empireCrystal)}% of empire</div>
        ${_ps(storCrys, crys)}
      </div>
      <div class="stat-card">
        <div class="stat-card-label">⚛ Helium-3</div>
        <div class="stat-card-value">${fmtNum(hel)}</div>
        <div class="stat-card-sub">${pct(hel,empireHelium)}% of empire</div>
        ${_ps(storHel, hel)}
      </div>
    </div>

    <!-- Storage table -->
    ${col.storage ? _pStorageSection(storOre, storCrys, storHel, ore, crys, hel) : ''}

    <!-- Buildings: chart + table side by side -->
    <div class="section-heading">Buildings</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.5rem;align-items:start">
      <div class="perf-chart-wrap" style="height:${Math.max(180, allBuildings.length * 36)}px;max-height:none">
        <canvas id="p-chart-buildings"></canvas>
      </div>
      <div>${renderBuildingGroups(col.buildings||{})}</div>
    </div>

    <!-- Defenses: chart + table side by side -->
    <div class="section-heading">Defenses</div>
    ${defEntries.length ? `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.5rem;align-items:start">
      <div class="perf-chart-wrap" style="height:${Math.max(180, defEntries.length * 36)}px;max-height:none">
        <canvas id="p-chart-defense"></canvas>
      </div>
      <div>${renderOrderedTable(col.defenses||{}, P_DEFENSE_ORDER, 'Count')}</div>
    </div>` : '<p class="dim" style="font-size:0.85rem;padding:0.5rem 0 1rem">No defenses.</p>'}

    <!-- Fleet: chart + table side by side -->
    <div class="section-heading">Ships</div>
    ${shipEntries.length ? `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.5rem;align-items:start">
      <div class="perf-chart-wrap" style="height:${Math.max(180, shipEntries.length * 36)}px;max-height:none">
        <canvas id="p-chart-fleet"></canvas>
      </div>
      <div>${renderOrderedTable(col.ships||{}, P_SHIP_ORDER, 'Count')}</div>
    </div>` : '<p class="dim" style="font-size:0.85rem;padding:0.5rem 0 1rem">No ships.</p>'}
  `;

  requestAnimationFrame(() => {
    destroyPChart('buildings');
    const ctxB = document.getElementById('p-chart-buildings');
    if (ctxB && buildingLabels.length) {
      _pCharts['buildings'] = new Chart(ctxB, {
        type: 'bar',
        data: {
          labels: buildingLabels,
          datasets: [{ data: buildingValues, backgroundColor: buildingColors, borderWidth: 0, borderRadius: 3 }],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor:'#1c1b19', borderColor:'#2e2d2a', borderWidth:1,
              titleColor:'#cdccca', bodyColor:'#9fd0d8',
              callbacks: { label: ctx => ` Level ${ctx.parsed.x}` },
            },
          },
          scales: {
            x: { ticks:{ color:'#7a7975', font:{size:9} }, grid:{ color:'#2e2d2a' } },
            y: { ticks:{ color:'#cdccca', font:{size:9} }, grid:{ display:false } },
          },
        },
      });
    }

    destroyPChart('defense');
    const ctxD = document.getElementById('p-chart-defense');
    if (ctxD && defEntries.length) {
      _pCharts['defense'] = new Chart(ctxD, {
        type: 'bar',
        data: {
          labels: defEntries.map(([,l])=>l),
          datasets: [{ data: defEntries.map(([k])=>col.defenses[k]||0), backgroundColor:'#c0575acc', borderWidth:0, borderRadius:3 }],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display:false },
            tooltip: {
              backgroundColor:'#1c1b19', borderColor:'#2e2d2a', borderWidth:1,
              titleColor:'#cdccca', bodyColor:'#9fd0d8',
              callbacks: { label: ctx => ` ${ctx.parsed.x.toLocaleString()}` },
            },
          },
          scales: {
            x: { ticks:{ color:'#7a7975', font:{size:9}, callback:v=>fmtNum(v) }, grid:{ color:'#2e2d2a' } },
            y: { ticks:{ color:'#cdccca', font:{size:9} }, grid:{ display:false } },
          },
        },
      });
    }

    destroyPChart('fleet');
    const ctxF = document.getElementById('p-chart-fleet');
    if (ctxF && shipEntries.length) {
      _pCharts['fleet'] = new Chart(ctxF, {
        type: 'bar',
        data: {
          labels: shipEntries.map(([,l])=>l),
          datasets: [{ data: shipEntries.map(([k])=>col.ships[k]||0), backgroundColor:'#4f98a3cc', borderWidth:0, borderRadius:3 }],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display:false },
            tooltip: {
              backgroundColor:'#1c1b19', borderColor:'#2e2d2a', borderWidth:1,
              titleColor:'#cdccca', bodyColor:'#9fd0d8',
              callbacks: { label: ctx => ` ${ctx.parsed.x.toLocaleString()}` },
            },
          },
          scales: {
            x: { ticks:{ color:'#7a7975', font:{size:9}, callback:v=>fmtNum(v) }, grid:{ color:'#2e2d2a' } },
            y: { ticks:{ color:'#cdccca', font:{size:9} }, grid:{ display:false } },
          },
        },
      });
    }
  });
}

/* ── Unchanged helpers ───────────────────────────────────── */

function renderBuildingGroups(buildings) {
  return BUILDING_GROUPS.map(group => {
    const rows = group.items.map(([key,label,maxLvl]) => {
      const lvl = buildings[key];
      if (lvl == null) return '';
      let levelHtml;
      if (maxLvl !== null) {
        if (lvl >= maxLvl)       levelHtml = `<td class="num" style="color:var(--success);font-weight:600">${lvl} <span style="font-size:0.7rem">MAX</span></td>`;
        else if (lvl===maxLvl-1) levelHtml = `<td class="num" style="color:#c49a3c;font-weight:600">${lvl}</td>`;
        else                      levelHtml = `<td class="num">${lvl}</td>`;
      } else {
        levelHtml = `<td class="num">${lvl}</td>`;
      }
      return `<tr><td>${label}</td>${levelHtml}</tr>`;
    }).filter(Boolean).join('');
    if (!rows) return '';
    return `
      <div style="margin-bottom:0.25rem">
        <div style="font-size:0.7rem;letter-spacing:0.06em;text-transform:uppercase;color:var(--text-muted);padding:0.4rem 0.75rem;background:var(--surface2);border-radius:var(--radius) var(--radius) 0 0">${group.label}</div>
        <div class="data-table-wrap" style="margin-bottom:0">
          <table class="data-table" style="border-radius:0 0 var(--radius) var(--radius)">
            <thead><tr><th>Building</th><th class="num">Level</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  }).join('<div style="height:0.4rem"></div>');
}

function renderOrderedTable(obj, order, colLabel) {
  const rows = order.filter(([k])=>(obj[k]||0)>0)
    .map(([k,label])=>`<tr><td>${label}</td><td class="num">${Number(obj[k]).toLocaleString()}</td></tr>`)
    .join('');
  if (!rows) return '<p class="dim" style="font-size:0.85rem;padding:0.5rem 0">None.</p>';
  return `<div class="data-table-wrap"><table class="data-table">
    <thead><tr><th>Type</th><th class="num">${colLabel}</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}