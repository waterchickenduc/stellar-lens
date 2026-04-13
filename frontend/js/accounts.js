/* accounts.js — share controls moved to dashboard Share button */
var _accounts = [];
var _editingId = null;

async function loadAccounts() {
  var el = document.getElementById('accounts-list');
  if (!el) return;
  el.innerHTML = '<p class="muted" style="padding:0.5rem 0">Loading accounts...</p>';
  try {
    _accounts = await apiFetch('/api/accounts');
    renderAccountList();
  } catch (err) {
    el.innerHTML = '<p class="msg-error">' + esc(err.message) + '</p>';
  }
}

function renderAccountList() {
  var el = document.getElementById('accounts-list');
  if (!el) return;
  if (!_accounts.length) {
    el.innerHTML = '<div class="empty-state">No accounts linked yet. Add one below.</div>';
    return;
  }
  el.innerHTML = _accounts.map(renderAccountCard).join('');
}

function renderAccountCard(acc) {
  var lastFetched = acc.last_fetched ? timeSince(acc.last_fetched) : 'Never';
  var badgeClass  = acc.is_active ? 'badge-active' : 'badge-inactive';
  var badgeLabel  = acc.is_active ? 'Active' : 'Paused';
  var errorHtml   = acc.last_error ? '<span class="account-error">⚠ ' + esc(acc.last_error) + '</span>' : '';
  var shareHtml   = acc.public_token
    ? '<div class="account-meta"><span class="muted">Public link:</span> ' +
      '<span style="font-size:0.78rem;color:var(--success)">Active — manage via dashboard Share button</span></div>'
    : '';
  var sharedBadge = acc.public_token
    ? '<span class="badge" style="border-color:var(--success);color:var(--success)">🔗 Shared</span>' : '';
  return '<div class="account-card" id="acc-card-' + acc.id + '">' +
    '<div class="account-header">' +
      '<div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap">' +
        '<span class="account-name">' + esc(acc.display_name) + '</span>' +
        '<span class="badge ' + badgeClass + '">' + badgeLabel + '</span>' +
        sharedBadge +
      '</div>' +
      '<div class="account-actions">' +
        '<button class="btn btn-sm" onclick="accountFetchNow(' + acc.id + ', this)">⟳ Pull Now</button>' +
        '<button class="btn btn-sm" onclick="accountToggle(' + acc.id + ', ' + (acc.is_active ? 1 : 0) + ')">' +
          (acc.is_active ? 'Pause' : 'Resume') +
        '</button>' +
        '<button class="btn btn-sm btn-primary" onclick="accountOpenEdit(' + acc.id + ')">Edit</button>' +
        '<button class="btn btn-sm btn-danger"  onclick="accountDelete(' + acc.id + ')">Delete</button>' +
      '</div>' +
    '</div>' +
    '<div class="account-meta"><span class="muted">URL:</span> <span class="account-url">' + esc(acc.api_url) + '</span></div>' +
    '<div class="account-meta"><span class="muted">Last pulled:</span> <span>' + lastFetched + '</span>' + errorHtml + '</div>' +
    shareHtml +
  '</div>';
}

async function accountFetchNow(id, btn) {
  btn.disabled = true; btn.textContent = '...';
  try {
    await apiFetch('/api/accounts/' + id + '/fetch', { method: 'POST' });
    showToast('Pull triggered — data refreshes in a moment.', 'success');
    setTimeout(loadAccounts, 1500);
  } catch (err) {
    showToast(err.message, 'error');
    btn.disabled = false; btn.textContent = '⟳ Pull Now';
  }
}

async function accountToggle(id, currentActive) {
  try {
    await apiFetch('/api/accounts/' + id, {
      method: 'PATCH', body: JSON.stringify({ is_active: !currentActive }),
    });
    await loadAccounts();
  } catch (err) { showToast(err.message, 'error'); }
}

async function accountDelete(id) {
  var acc  = _accounts.find(function(a) { return a.id === id; });
  var name = acc ? acc.display_name : 'this account';
  if (!confirm('Delete "' + name + '"?\n\nThis permanently removes the account and ALL snapshot history.')) return;
  try {
    await apiFetch('/api/accounts/' + id, { method: 'DELETE' });
    showToast('Account deleted.', 'success');
    await loadAccounts();
  } catch (err) { showToast(err.message, 'error'); }
}

function accountOpenAdd() {
  _editingId = null;
  document.getElementById('acc-modal-title').textContent = 'Add Game Account';
  document.getElementById('acc-form-name').value = '';
  document.getElementById('acc-form-url').value  = '';
  document.getElementById('acc-modal-error').textContent = '';
  document.getElementById('acc-modal').classList.remove('hidden');
  document.getElementById('acc-form-name').focus();
}

function accountOpenEdit(id) {
  var acc = _accounts.find(function(a) { return a.id === id; });
  if (!acc) return;
  _editingId = id;
  document.getElementById('acc-modal-title').textContent = 'Edit Account';
  document.getElementById('acc-form-name').value = acc.display_name;
  document.getElementById('acc-form-url').value  = acc.api_url;
  document.getElementById('acc-modal-error').textContent = '';
  document.getElementById('acc-modal').classList.remove('hidden');
  document.getElementById('acc-form-name').focus();
}

function accountCloseModal() {
  document.getElementById('acc-modal').classList.add('hidden');
  _editingId = null;
}

async function accountSave() {
  var name  = document.getElementById('acc-form-name').value.trim();
  var url   = document.getElementById('acc-form-url').value.trim();
  var errEl = document.getElementById('acc-modal-error');
  errEl.textContent = '';
  if (!name) { errEl.textContent = 'Display name is required.'; return; }
  if (!url)  { errEl.textContent = 'API URL is required.'; return; }
  if (!url.startsWith('http')) { errEl.textContent = 'URL must start with http:// or https://'; return; }
  var saveBtn = document.getElementById('acc-modal-save');
  saveBtn.disabled = true; saveBtn.textContent = 'Saving...';
  try {
    if (_editingId) {
      await apiFetch('/api/accounts/' + _editingId, {
        method: 'PATCH', body: JSON.stringify({ display_name: name, api_url: url }),
      });
      showToast('Account updated.', 'success');
    } else {
      await apiFetch('/api/accounts', {
        method: 'POST', body: JSON.stringify({ display_name: name, api_url: url }),
      });
      showToast('Account added! First pull starts within 15 minutes.', 'success');
    }
    accountCloseModal();
    await loadAccounts();
  } catch (err) {
    errEl.textContent = err.message;
  } finally {
    saveBtn.disabled = false; saveBtn.textContent = 'Save';
  }
}

function timeSince(iso) {
  var diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 60)    return diff + 's ago';
  if (diff < 3600)  return Math.floor(diff/60) + 'm ago';
  if (diff < 86400) return Math.floor(diff/3600) + 'h ago';
  return new Date(iso).toLocaleDateString();
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
