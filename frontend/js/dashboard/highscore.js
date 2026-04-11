/* highscore.js — ranks, points, account stats + full-width history charts */

const _hsCharts = {};
function destroyHsChart(id) {
  if (_hsCharts[id]) { _hsCharts[id].destroy(); delete _hsCharts[id]; }
}

async function renderHighscore(d) {
  const el = document.getElementById('panel-highscore');
  if (!el) return;

  const ranks = d.ranks || {};
  const rankLabels = {
    globalPoints:'Global Points', economyPoints:'Economy',
    researchPoints:'Research', militaryPoints:'Military', defensePoints:'Defense',
  };
  const pointKeys = {
    globalPoints: d.globalPoints, economyPoints: d.economyPoints,
    researchPoints: d.researchPoints, militaryPoints: d.militaryPoints,
    defensePoints: d.defensePoints,
  };

  el.innerHTML = `
    <div class="section-heading">Rankings &amp; Points</div>
    <div class="stat-cards">
      ${Object.entries(rankLabels).map(([k, label]) => `
        <div class="stat-card">
          <div class="stat-card-label">${label}</div>
          <div class="stat-card-value">${fmtNum(pointKeys[k])}</div>
          <div class="stat-card-rank">Rank #${ranks[k] ?? '—'}</div>
        </div>`).join('')}
      <div class="stat-card">
        <div class="stat-card-label">Level / Colonies</div>
        <div class="stat-card-value">${d.level} <span style="font-size:1rem;color:var(--text-muted)">/ ${d.colonies}</span></div>
        <div class="stat-card-sub">Anomaly Lvl ${d.anomalyLevel}</div>
      </div>
    </div>

    <div class="section-heading">Account Statistics</div>
    <div class="stat-cards">
      <div class="stat-card">
        <div class="stat-card-label">Doctrine</div>
        <div class="stat-card-value" style="font-size:1rem;text-transform:capitalize">${d.doctrine||'—'}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-label">Expeditions</div>
        <div class="stat-card-value">${d.totalExpeditions??'—'}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-label">Battle Victories</div>
        <div class="stat-card-value">${d.totalBattleVictories??'—'}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-label">XP</div>
        <div class="stat-card-value">${fmtNum(d.xp)}</div>
      </div>
    </div>

    <div class="section-heading">Points Over Time</div>
    <div class="hs-chart-wrap"><canvas id="hs-chart-points"></canvas></div>

    <div class="section-heading">Rankings Over Time
      <span style="font-size:0.72rem;font-weight:400;text-transform:none;letter-spacing:0;color:var(--text-muted)">(lower = better)</span>
    </div>
    <div class="hs-chart-wrap"><canvas id="hs-chart-ranks"></canvas></div>

    <div class="section-heading">Activity Over Time</div>
    <div class="hs-chart-wrap"><canvas id="hs-chart-activity"></canvas></div>
  `;

  try {
    const res = await apiFetch(`/api/accounts/${Dash.currentAccountId}/history?limit=500`);
    const history = res.history || [];
    if (history.length < 2) return;

    const labels = history.map(h => {
      const dd = new Date(h.fetched_at);
      return dd.toLocaleDateString('en-GB',{day:'2-digit',month:'short'})
        +' '+dd.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
    });

    const baseOpts = (reverse, yFmt) => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode:'index', intersect:false },
      plugins: {
        legend: { labels:{ color:'#9a9893', boxWidth:12, font:{size:11} } },
        tooltip: {
          backgroundColor:'#252422', borderColor:'#3a3936', borderWidth:1,
          titleColor:'#e2e1df', bodyColor:'#9fd0d8',
          callbacks: { label: ctx => ` ${ctx.dataset.label}: ${yFmt(ctx.parsed.y)}` },
        },
      },
      scales: {
        x: { ticks:{ color:'#9a9893', maxTicksLimit:12, font:{size:10} }, grid:{ color:'#3a3936' } },
        y: { reverse, ticks:{ color:'#9a9893', font:{size:10}, callback:yFmt }, grid:{ color:'#3a3936' } },
      },
    });

    const mkDs = (label, data, color) => ({
      label, data,
      borderColor: color, backgroundColor: color+'18',
      borderWidth: 2,
      pointRadius: data.length > 100 ? 0 : 2,
      pointHoverRadius: 4,
      tension: 0.3, fill: false,
    });

    destroyHsChart('points');
    const ctxP = document.getElementById('hs-chart-points');
    if (ctxP) _hsCharts['points'] = new Chart(ctxP, {
      type: 'line',
      data: { labels, datasets: [
        mkDs('Global',   history.map(h=>h.globalPoints),   '#9fd0d8'),
        mkDs('Economy',  history.map(h=>h.economyPoints),  '#4fa36e'),
        mkDs('Research', history.map(h=>h.researchPoints), '#4f98a3'),
        mkDs('Military', history.map(h=>h.militaryPoints), '#c49a3c'),
        mkDs('Defense',  history.map(h=>h.defensePoints),  '#c0575a'),
      ]},
      options: baseOpts(false, v => fmtNum(v)),
    });

    destroyHsChart('ranks');
    const ctxR = document.getElementById('hs-chart-ranks');
    if (ctxR) _hsCharts['ranks'] = new Chart(ctxR, {
      type: 'line',
      data: { labels, datasets: [
        mkDs('Global',   history.map(h=>h.ranks?.globalPoints),   '#9fd0d8'),
        mkDs('Economy',  history.map(h=>h.ranks?.economyPoints),  '#4fa36e'),
        mkDs('Research', history.map(h=>h.ranks?.researchPoints), '#4f98a3'),
        mkDs('Military', history.map(h=>h.ranks?.militaryPoints), '#c49a3c'),
        mkDs('Defense',  history.map(h=>h.ranks?.defensePoints),  '#c0575a'),
      ]},
      options: baseOpts(true, v => `#${v}`),
    });

    destroyHsChart('activity');
    const ctxA = document.getElementById('hs-chart-activity');
    if (ctxA) _hsCharts['activity'] = new Chart(ctxA, {
      type: 'line',
      data: { labels, datasets: [
        mkDs('Level',       history.map(h=>h.level),                '#9fd0d8'),
        mkDs('Expeditions', history.map(h=>h.totalExpeditions),     '#4fa36e'),
        mkDs('Victories',   history.map(h=>h.totalBattleVictories), '#c0575a'),
        mkDs('Anomaly Lvl', history.map(h=>h.anomalyLevel),         '#c49a3c'),
      ]},
      options: baseOpts(false, v => v),
    });

  } catch(e) { /* charts not critical */ }
}
