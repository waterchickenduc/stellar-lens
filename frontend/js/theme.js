/* frontend/js/theme.js — dark/light toggle */

function initTheme() {
  const saved = localStorage.getItem('stellar_theme') || 'dark';
  applyTheme(saved, false);
}

function applyTheme(theme, save = true) {
  document.documentElement.classList.toggle('light', theme === 'light');
  if (save) localStorage.setItem('stellar_theme', theme);

  // Update all toggle buttons
  document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
    btn.textContent = theme === 'light' ? '🌙 Dark mode' : '☀ Light mode';
  });
}

function toggleTheme() {
  const current = localStorage.getItem('stellar_theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
}
