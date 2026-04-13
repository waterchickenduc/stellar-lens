/* share.js — Dashboard share modal */
'use strict';

var SHARE_ALL_TABS = [
  { key: 'overview',    label: '🌐 Overview' },
  { key: 'planet',      label: '🪐 Per Planet' },
  { key: 'research',    label: '🔬 Research' },
  { key: 'performance', label: '📈 Performance' },
  { key: 'highscore',   label: '🏆 Highscore' },
];

var SHARE_HOUR_OPTIONS = [
  { value: 1,   label: '1 hour' },
  { value: 6,   label: '6 hours' },
  { value: 24,  label: '24 hours' },
  { value: 168, label: '7 days' },
];

var _shareAccountId    = null;
var _shareToken        = null;
var _shareTabsActive   = SHARE_ALL_TABS.map(function(t) { return t.key; });
var _shareHistoryHours = 1;

async function openShareModal() {
  var accountId = Dash && Dash.currentAccountId;
  if (!accountId) { showToast('Select an account first.', 'error'); return; }
  _shareAccountId = accountId;
  try {
    var accounts = await apiFetch('/api/accounts');
    var acc = accounts.find(function(a) { return a.id === accountId; });
    if (!acc) { showToast('Account not found.', 'error'); return; }
    _shareToken        = acc.public_token || null;
    _shareHistoryHours = acc.public_history_hours || 1;
    try {
      var stored = acc.public_tabs ? JSON.parse(acc.public_tabs) : null;
      _shareTabsActive = (Array.isArray(stored) && stored.length)
        ? stored : SHARE_ALL_TABS.map(function(t) { return t.key; });
    } catch (_) {
      _shareTabsActive = SHARE_ALL_TABS.map(function(t) { return t.key; });
    }
    _renderShareModal();
    document.getElementById('share-modal').classList.remove('hidden');
  } catch (err) { showToast(err.message, 'error'); }
}

function closeShareModal() {
  document.getElementById('share-modal').classList.add('hidden');
}

function _renderShareModal() {
  var isShared = !!_shareToken;
  var shareUrl = isShared ? window.location.origin + '/public.html?t=' + _shareToken : null;

  var statusEl = document.getElementById('share-status-section');
  if (isShared) {
    statusEl.innerHTML =
      '<div class="share-status-badge share-status-on">🔗 Sharing active</div>' +
      '<div class="share-url-row">' +
        '<input class="share-url-input" id="share-url-display" value="' + escShare(shareUrl) + '" readonly>' +
        '<button class="btn btn-sm" onclick="shareModalCopyUrl()">Copy</button>' +
      '</div>';
  } else {
    statusEl.innerHTML =
      '<div class="share-status-badge share-status-off">🔒 Not shared</div>' +
      '<p class="muted" style="margin:0;font-size:0.83rem">Generate a link to let anyone view this dashboard without logging in.</p>';
  }

  document.getElementById('share-tabs-list').innerHTML = SHARE_ALL_TABS.map(function(t) {
    return '<label class="share-tab-toggle">' +
      '<input type="checkbox" value="' + t.key + '" ' + (_shareTabsActive.indexOf(t.key) >= 0 ? 'checked' : '') + '>' +
      '<span>' + t.label + '</span>' +
    '</label>';
  }).join('');

  document.getElementById('share-history-select').innerHTML = SHARE_HOUR_OPTIONS.map(function(o) {
    return '<option value="' + o.value + '" ' + (o.value === _shareHistoryHours ? 'selected' : '') + '>' + o.label + '</option>';
  }).join('');

  document.getElementById('share-btn-generate').style.display = isShared ? 'none'        : 'inline-flex';
  document.getElementById('share-btn-save'    ).style.display = isShared ? 'inline-flex' : 'none';
  document.getElementById('share-btn-revoke'  ).style.display = isShared ? 'inline-flex' : 'none';
}

function _getSelectedTabs() {
  return Array.from(document.querySelectorAll('#share-tabs-list input[type=checkbox]:checked'))
    .map(function(cb) { return cb.value; });
}

function _getSelectedHours() {
  var sel = document.getElementById('share-history-select');
  return sel ? Number(sel.value) : 1;
}

function shareModalCopyUrl() {
  var input = document.getElementById('share-url-display');
  if (!input) return;
  navigator.clipboard.writeText(input.value)
    .then(function() { showToast('Link copied to clipboard!', 'success'); })
    .catch(function() { prompt('Copy this link:', input.value); });
}

function escShare(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* Generate — only called when no link exists yet. Uses POST. */
async function shareGenerate() {
  var tabs  = _getSelectedTabs();
  var hours = _getSelectedHours();
  if (!tabs.length) { showToast('Select at least one tab to share.', 'error'); return; }
  var btn = document.getElementById('share-btn-generate');
  btn.disabled = true; btn.textContent = 'Generating...';
  try {
    var res = await apiFetch('/api/accounts/' + _shareAccountId + '/share', {
      method: 'POST', body: JSON.stringify({ tabs: tabs, history_hours: hours }),
    });
    _shareToken        = res.public_token;
    _shareTabsActive   = res.public_tabs   || tabs;
    _shareHistoryHours = res.public_history_hours || hours;
    _renderShareModal();
    showToast('Public link created!', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Generate Link';
  }
}

/* Save — only called when a link already exists. Uses PATCH — token is never touched. */
async function shareSave() {
  var tabs  = _getSelectedTabs();
  var hours = _getSelectedHours();
  if (!tabs.length) { showToast('Select at least one tab to share.', 'error'); return; }
  var btn = document.getElementById('share-btn-save');
  btn.disabled = true; btn.textContent = 'Saving...';
  try {
    var res = await apiFetch('/api/accounts/' + _shareAccountId + '/share', {
      method: 'PATCH', body: JSON.stringify({ tabs: tabs, history_hours: hours }),
    });
    // Token is unchanged — only update prefs locally
    _shareTabsActive   = res.public_tabs   || tabs;
    _shareHistoryHours = res.public_history_hours || hours;
    _renderShareModal();
    showToast('Preferences saved — link unchanged.', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Save Preferences';
  }
}

/* Revoke — deletes the token entirely. */
async function shareRevoke() {
  if (!confirm('Revoke this public link?\n\nAnyone with the link will immediately lose access.')) return;
  var btn = document.getElementById('share-btn-revoke');
  btn.disabled = true; btn.textContent = 'Revoking...';
  try {
    await apiFetch('/api/accounts/' + _shareAccountId + '/share', { method: 'DELETE' });
    _shareToken        = null;
    _shareTabsActive   = SHARE_ALL_TABS.map(function(t) { return t.key; });
    _shareHistoryHours = 1;
    _renderShareModal();
    showToast('Public link revoked.', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Revoke Link';
  }
}
