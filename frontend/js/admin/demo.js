/* frontend/js/admin/demo.js — Demo account management */
'use strict';

var _demoAccounts = [];

async function loadDemo() {
  try {
    var [accRes, demoRes] = await Promise.all([
      apiFetch('/api/admin/accounts'),
      apiFetch('/api/admin/demo'),
    ]);
    _demoAccounts = accRes.accounts || [];
    renderDemoSection(demoRes.demo);
  } catch(e) {
    document.getElementById('demo-status').textContent = 'Error loading demo config.';
  }
}

function renderDemoSection(currentDemo) {
  var sel = document.getElementById('demo-account-select');
  if (!sel) return;

  sel.innerHTML = '<option value="">— None (disable demo) —</option>';
  _demoAccounts.forEach(function(acc) {
    var opt = document.createElement('option');
    opt.value = acc.id;
    opt.textContent = acc.display_name + ' (' + acc.user_email + ')';
    if (currentDemo && acc.id === currentDemo.id) opt.selected = true;
    sel.appendChild(opt);
  });

  var apiInput = document.getElementById('demo-api-url');
  if (apiInput && currentDemo) apiInput.value = currentDemo.api_url || '';
  else if (apiInput) apiInput.value = '';

  var status = document.getElementById('demo-status');
  if (currentDemo) {
    status.innerHTML = '<span style="color:var(--success)">🟢 Active</span> — ' +
      '<strong>' + esc(currentDemo.display_name) + '</strong>';
  } else {
    status.innerHTML = '<span style="color:var(--text-muted)">⚫ No demo configured</span>';
  }

  // When account selection changes, pre-fill API URL
  sel.onchange = function() {
    var chosen = _demoAccounts.find(function(a) { return a.id === Number(sel.value); });
    if (chosen && apiInput) apiInput.value = chosen.api_url || '';
    else if (apiInput) apiInput.value = '';
  };
}

async function saveDemo() {
  var sel      = document.getElementById('demo-account-select');
  var apiInput = document.getElementById('demo-api-url');
  var statusEl = document.getElementById('demo-save-status');
  if (!sel) return;

  var account_id = sel.value ? Number(sel.value) : null;
  var api_url    = apiInput ? apiInput.value.trim() : '';

  statusEl.textContent = 'Saving...';
  try {
    await apiFetch('/api/admin/demo', {
      method: 'POST',
      body: JSON.stringify({ account_id: account_id, api_url: api_url || undefined }),
    });
    statusEl.style.color = 'var(--success)';
    statusEl.textContent = '✓ Saved';
    await loadDemo();
    setTimeout(function() { statusEl.textContent = ''; }, 3000);
  } catch(e) {
    statusEl.style.color = 'var(--danger)';
    statusEl.textContent = 'Error: ' + e.message;
  }
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// apiFetch for admin context (uses API.getToken)
function apiFetch(path, opts) {
  var options = opts || {};
  options.headers = Object.assign({ 'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + API.getToken() }, options.headers || {});
  return fetch('/api' + path.replace(/^\/api/, ''), options).then(function(r) {
    return r.json().then(function(data) {
      if (!r.ok) throw Object.assign(new Error(data.error || 'Request failed'), { data: data });
      return data;
    });
  });
}
