/* frontend/js/admin/stats.js */

// Load and render stats cards
async function loadStats() {
  try {
    const d = await API.get('/admin/stats');
    document.getElementById('stat-users').textContent     = d.totalUsers;
    document.getElementById('stat-confirmed').textContent = d.confirmedUsers;
    document.getElementById('stat-accounts').textContent  = d.totalAccounts;
    document.getElementById('stat-snapshots').textContent = d.totalSnapshots;
  } catch (e) {
    toast('Failed to load stats: ' + e.message, 'error');
  }
}

async function loadSettings() {
  try {
    const { settings } = await API.get('/admin/settings');
    const el = document.getElementById('setting-pull-interval');
    if (el && settings.pull_interval_minutes) {
      el.value = settings.pull_interval_minutes;
    }
  } catch(e) { /* not critical */ }
}

async function saveSettings() {
  const el  = document.getElementById('setting-pull-interval');
  const statusEl = document.getElementById('settings-status');
  if (!el) return;

  const val = parseInt(el.value);
  if (isNaN(val) || val < 1 || val > 1440) {
    statusEl.style.color = 'var(--danger)';
    statusEl.textContent = 'Invalid value (1–1440)';
    return;
  }

  try {
    await API.post('/admin/settings', { key: 'pull_interval_minutes', value: val });
    statusEl.style.color = 'var(--success)';
    statusEl.textContent = `✓ Saved — pulling every ${val} minute(s)`;
    setTimeout(() => { statusEl.textContent = ''; }, 3000);
  } catch(e) {
    statusEl.style.color = 'var(--danger)';
    statusEl.textContent = e.message;
  }
}