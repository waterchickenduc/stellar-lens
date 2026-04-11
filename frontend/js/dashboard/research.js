/* research.js — research progress bars */

const RESEARCH_ORDER = [
  { key: 'energy_tech',            label: 'Atomic Fusion',   max: 30 },
  { key: 'storage_tech',           label: 'Storage',         max: 30 },
  { key: 'production_tech',        label: 'Production',      max: 30 },
  { key: 'laser_tech',             label: 'Laser',           max: 30 },
  { key: 'ion_tech',               label: 'Ionic',           max: 30 },
  { key: 'hyperspace_tech',        label: 'Hyperspace',      max: 30 },
  { key: 'plasma_tech',            label: 'Plasma',          max: 30 },
  { key: 'combustion_drive',       label: 'Combustion',      max: 30 },
  { key: 'espionage_tech',         label: 'Espionage',       max: 30 },
  { key: 'weapons_tech',           label: 'Weapons',         max: 30 },
  { key: 'armour_tech',            label: 'Armor',           max: 30 },
  { key: 'shielding_tech',         label: 'Shields',         max: 30 },
  { key: 'impulse_drive',          label: 'Impulse',         max: 30 },
  { key: 'hyperspace_drive',       label: 'Quantum Drive',   max: 30 },
  { key: 'astrophysics',           label: 'Astrophysics',    max: 9  },
  { key: 'computer_tech',          label: 'Computing',       max: 30 },
  { key: 'intergalactic_research', label: 'Galactic Network',max: 30 },
  { key: 'graviton_tech',          label: 'Graviton',        max: 28 },
];

function renderResearch(d) {
  const el = document.getElementById('panel-research');
  if (!el) return;
  const r = d.research || {};

  const rows = RESEARCH_ORDER.map(item => {
    const lvl = r[item.key] || 0;
    const pct = Math.min(100, Math.round((lvl / item.max) * 100));
    const color = lvl >= item.max ? 'var(--success)' : 'var(--primary)';
    return `
      <div style="display:flex;align-items:center;gap:0.75rem">
        <div style="width:150px;font-size:0.82rem;color:var(--text);flex-shrink:0">${item.label}</div>
        <div class="progress-bar-wrap">
          <div class="progress-bar-fill" style="width:${pct}%;background:${color}"></div>
        </div>
        <div style="font-size:0.78rem;color:var(--text-muted);width:52px;text-align:right;flex-shrink:0">
          ${lvl} / ${item.max}
        </div>
      </div>`;
  }).join('');

  el.innerHTML = `<div style="display:flex;flex-direction:column;gap:0.65rem">${rows}</div>`;
}
