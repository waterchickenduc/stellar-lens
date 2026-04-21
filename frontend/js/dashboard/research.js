/* frontend/js/dashboard/research.js — research table */
const RESEARCH_ORDER = [
  { key: 'energy_tech',            label: 'Atomic Fusion',    max: 30, category: 'Economy' },
  { key: 'storage_tech',           label: 'Storage',          max: 30, category: 'Economy' },
  { key: 'production_tech',        label: 'Production',       max: 30, category: 'Economy' },
  { key: 'laser_tech',             label: 'Laser',            max: 30, category: 'Economy' },
  { key: 'ion_tech',               label: 'Ionic',            max: 30, category: 'Economy' },
  { key: 'hyperspace_tech',        label: 'Hyperspace',       max: 30, category: 'Economy' },
  { key: 'plasma_tech',            label: 'Plasma',           max: 30, category: 'Economy' },
  { key: 'combustion_drive',       label: 'Combustion',       max: 30, category: 'Military' },
  { key: 'espionage_tech',         label: 'Espionage',        max: 30, category: 'Military' },
  { key: 'weapons_tech',           label: 'Weapons',          max: 30, category: 'Military' },
  { key: 'armour_tech',            label: 'Armor',            max: 30, category: 'Military' },
  { key: 'shielding_tech',         label: 'Shields',          max: 30, category: 'Military' },
  { key: 'impulse_drive',          label: 'Impulse',          max: 30, category: 'Military' },
  { key: 'hyperspace_drive',       label: 'Quantum Drive',    max: 30, category: 'Military' },
  { key: 'astrophysics',           label: 'Astrophysics',     max: 9,  category: 'Advanced' },
  { key: 'computer_tech',          label: 'Computing',        max: 30, category: 'Advanced' },
  { key: 'intergalactic_research', label: 'Galactic Network', max: 30, category: 'Advanced' },
  { key: 'graviton_tech',          label: 'Graviton',         max: 28, category: 'Advanced' },
];

function renderResearch(d) {
  const el = document.getElementById('panel-research');
  if (!el) return;
  const r = d.research || {};

  const categories = ['Economy', 'Military', 'Advanced'];

  const sections = categories.map(cat => {
    const items = RESEARCH_ORDER.filter(i => i.category === cat);
    const rows = items.map(item => {
      const lvl   = r[item.key] || 0;
      const pct   = Math.min(100, Math.round((lvl / item.max) * 100));
      const maxed = lvl >= item.max;
      const lvlColor  = maxed ? 'var(--success)' : 'var(--text)';
      const pctColor  = maxed ? 'var(--success)' : 'var(--text-muted)';
      const barColor  = maxed ? 'var(--success)' : 'var(--primary)';
      const lvlWeight = maxed ? '700' : '400';

      return `
        <tr>
          <td style="color:var(--text);padding:0.55rem 0.75rem">${item.label}</td>
          <td class="num" style="padding:0.55rem 0.75rem">
            <span style="color:${lvlColor};font-weight:${lvlWeight}">${lvl}</span>
            <span style="color:var(--text-muted)"> / ${item.max}</span>
          </td>
          <td style="padding:0.55rem 0.75rem;width:160px">
            <div style="display:flex;align-items:center;gap:0.5rem">
              <div style="flex:1;background:var(--surface2);border-radius:99px;height:5px;overflow:hidden">
                <div style="width:${pct}%;height:100%;background:${barColor};border-radius:99px"></div>
              </div>
              <span style="font-size:0.75rem;color:${pctColor};width:36px;text-align:right;flex-shrink:0">${pct}%</span>
            </div>
          </td>
        </tr>`;
    }).join('');

    return `
      <div style="margin-bottom:1.5rem">
        <div class="section-heading">${cat}</div>
        <div class="data-table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Research</th>
                <th class="num">Level</th>
                <th>Progress</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  }).join('');

  el.innerHTML = sections;
}
