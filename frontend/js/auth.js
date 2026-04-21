/* frontend/js/auth.js */
// Auth helpers used across all pages
function requireLogin() {
  const token = API.getToken();
  if (!token) { window.location.href = '/index.html'; return false; }
  return true;
}

function requireGuest() {
  const token = API.getToken();
  if (token) { window.location.href = '/dashboard.html'; return false; }
  return true;
}

function logout() {
  API.clearToken();
  window.location.href = '/index.html';
}

// Show/hide alert helpers
function showError(el, msg) {
  el.className = 'alert alert-error show';
  el.textContent = msg;
}

function showSuccess(el, msg) {
  el.className = 'alert alert-success show';
  el.textContent = msg;
}

function hideAlert(el) {
  el.className = 'alert';
  el.textContent = '';
}

// Set button loading state
function setLoading(btn, yes) {
  btn.classList.toggle('loading', yes);
  btn.disabled = yes;
}
