/* frontend/js/settings.js — sidebar nav, change password, change email */

function initSidebar() {
  document.querySelectorAll('.sidebar-link[data-panel]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
      document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
      link.classList.add('active');
      const panel = document.getElementById(link.dataset.panel);
      if (panel) panel.classList.add('active');
    });
  });
}

function populateUserInfo() {
  const user = getUser();
  if (!user) return;
  const emailDisplay = document.getElementById('current-email-display');
  if (emailDisplay) emailDisplay.textContent = user.email || '—';
  const roleDisplay = document.getElementById('current-role-display');
  if (roleDisplay) roleDisplay.textContent = user.role || '—';
  const adminLink = document.getElementById('sidebar-admin-link');
  if (adminLink && user.role === 'admin') adminLink.style.display = 'block';
}

async function handleChangePassword(e) {
  e.preventDefault();
  const current = document.getElementById('pw-current').value;
  const newPw   = document.getElementById('pw-new').value;
  const confirm = document.getElementById('pw-confirm').value;
  const errEl   = document.getElementById('pw-error');
  const okEl    = document.getElementById('pw-ok');
  errEl.textContent = ''; okEl.textContent = '';

  if (newPw !== confirm)   { errEl.textContent = 'New passwords do not match.'; return; }
  if (newPw.length < 8)    { errEl.textContent = 'Password must be at least 8 characters.'; return; }
  if (newPw === current)   { errEl.textContent = 'New password must differ from current.'; return; }

  const btn = document.getElementById('pw-submit');
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    await apiFetch('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword: current, newPassword: newPw }),
    });
    okEl.textContent = '✓ Password changed successfully.';
    document.getElementById('pw-form').reset();
  } catch (err) {
    errEl.textContent = err.message;
  } finally {
    btn.disabled = false; btn.textContent = 'Save Password';
  }
}

async function handleChangeEmail(e) {
  e.preventDefault();
  const newEmail = document.getElementById('em-new').value.trim();
  const password = document.getElementById('em-password').value;
  const errEl    = document.getElementById('em-error');
  const okEl     = document.getElementById('em-ok');
  errEl.textContent = ''; okEl.textContent = '';

  if (!newEmail.includes('@')) { errEl.textContent = 'Enter a valid email address.'; return; }

  const btn = document.getElementById('em-submit');
  btn.disabled = true; btn.textContent = 'Sending…';
  try {
    await apiFetch('/api/auth/change-email', {
      method: 'POST',
      body: JSON.stringify({ newEmail, password }),
    });
    okEl.textContent = '✓ Confirmation link sent to your new address. Check your inbox.';
    document.getElementById('em-form').reset();
  } catch (err) {
    errEl.textContent = err.message;
  } finally {
    btn.disabled = false; btn.textContent = 'Send Confirmation';
  }
}

function initSettings() {
  initSidebar();
  populateUserInfo();
  document.getElementById('pw-form')?.addEventListener('submit', handleChangePassword);
  document.getElementById('em-form')?.addEventListener('submit', handleChangeEmail);
}
