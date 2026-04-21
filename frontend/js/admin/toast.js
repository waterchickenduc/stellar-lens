/* frontend/js/admin/toast.js */
// Toast notification helper
function toast(msg, type = 'success', ms = 3500) {
  const c = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => el.remove(), ms);
}
