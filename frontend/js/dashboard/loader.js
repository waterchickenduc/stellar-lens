/* loader.js — account switcher, snapshot loader, shared state */

const Dash = {
  accounts:         [],
  currentAccountId: null,
  snapshot:         null,
  activeTab:        'overview',
};

async function dashInit() {
  if (!getToken()) { window.location.href = '/login.html'; return; }
  initTheme();
  await dashLoadAccounts();
  dashInitTabs();
  dashInitPullBtn();
}

async function dashLoadAccounts() {
  try {
    Dash.accounts = await apiFetch('/api/accounts');
  } catch (e) {
    Dash.accounts = [];
  }
  renderSidebarAccounts();
  const first = Dash.accounts.find(a => a.is_active) || Dash.accounts[0];
  if (first) dashSelectAccount(first.id);
}

function renderSidebarAccounts() {
  const el = document.getElementById('sidebar-accounts');
  if (!el) return;
  if (!Dash.accounts.length) {
    el.innerHTML = `<div style="padding:0.75rem 1.25rem;font-size:0.8rem;color:var(--text-muted)">
      No accounts. <a href="/settings.html">Add one</a>
    </div>`;
    return;
  }
  el.innerHTML = Dash.accounts.map(acc => {
    const dot   = acc.is_active ? 'active' : '';
    const since = acc.last_fetched ? timeSince(acc.last_fetched) : 'never';
    return `
      <button class="sidebar-account-btn" id="acc-btn-${acc.id}"
              onclick="dashSelectAccount(${acc.id})">
        <span class="acc-name">${escHtml(acc.display_name)}</span>
        <span class="acc-meta">
          <span class="acc-dot ${dot}"></span>
          ${since}
        </span>
      </button>`;
  }).join('');
}

async function dashSelectAccount(id) {
  Dash.currentAccountId = id;

  // Highlight sidebar
  document.querySelectorAll('.sidebar-account-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById(`acc-btn-${id}`);
  if (btn) btn.classList.add('active');

  // Show share button and update its appearance
  const shareBtn = document.getElementById('share-tab-btn');
  if (shareBtn) {
    shareBtn.style.display = 'inline-flex';
    const acc = Dash.accounts.find(a => a.id === id);
    shareBtn.classList.toggle('is-shared', !!(acc && acc.public_token));
  }

  await dashLoadSnapshot();
}

async function dashLoadSnapshot() {
  const id = Dash.currentAccountId;
  if (!id) return;
  showTabLoading();
  try {
    const data = await apiFetch(`/api/accounts/${id}/snapshot`);
    Dash.snapshot = data.data;
    dashRenderActive();
    updateLastPull();
  } catch (e) {
    showTabError(e.message);
  }
}

function dashInitPullBtn() {
  const btn = document.getElementById('pull-btn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const id = Dash.currentAccountId;
    if (!id) return;
    btn.disabled = true;
    btn.classList.add('spinning');
    try {
      await apiFetch(`/api/accounts/${id}/fetch`, { method: 'POST' });
      showToast('Pull triggered — refreshing in 3s…', 'success');
      setTimeout(async () => {
        await dashLoadSnapshot();
        renderSidebarAccounts();
        btn.disabled = false;
        btn.classList.remove('spinning');
      }, 3000);
    } catch (e) {
      showToast(e.message, 'error');
      btn.disabled = false;
      btn.classList.remove('spinning');
    }
  });
}

function updateLastPull() {
  const el = document.getElementById('last-pull-label');
  if (!el) return;
  const acc = Dash.accounts.find(a => a.id === Dash.currentAccountId);
  if (acc && acc.last_fetched) el.textContent = timeSince(acc.last_fetched);
}

function dashInitTabs() {
  document.querySelectorAll('.dash-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const name = tab.dataset.tab;
      document.querySelectorAll('.dash-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.dash-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const panel = document.getElementById(`panel-${name}`);
      if (panel) panel.classList.add('active');
      Dash.activeTab = name;
      dashRenderActive();
    });
  });
}

function dashRenderActive() {
  if (!Dash.snapshot) return;
  const d = Dash.snapshot;
  switch (Dash.activeTab) {
    case 'overview':    renderOverview(d);    break;
    case 'planet':      renderPlanet(d);      break;
    case 'performance': renderPerformance();  break;
    case 'research':    renderResearch(d);    break;
    case 'highscore':   renderHighscore(d);   break;
  }
}

function showTabLoading() {
  document.querySelectorAll('.dash-panel').forEach(p => {
    p.innerHTML = '<div class="tab-loading">Loading…</div>';
  });
}

function showTabError(msg) {
  document.querySelectorAll('.dash-panel.active').forEach(p => {
    p.innerHTML = `<div class="tab-loading" style="color:var(--danger)">Error: ${escHtml(msg)}</div>`;
  });
}

function timeSince(iso) {
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmtNum(n) {
  if (n == null) return '—';
  if (n >= 1e9) return (n/1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n/1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n/1e3).toFixed(1) + 'K';
  return n.toLocaleString();
}
