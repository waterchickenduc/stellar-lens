/* toast.js — shared notification toasts */

const TOAST_DURATIONS = {
  error:   0,      // 0 = stays until dismissed
  warning: 10000,
  success: 4000,
  info:    4000,
};

function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  // Message text
  const text = document.createElement('span');
  text.className = 'toast-text';
  text.textContent = message;
  toast.appendChild(text);

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.className = 'toast-close';
  closeBtn.setAttribute('aria-label', 'Close notification');
  closeBtn.textContent = '×';
  closeBtn.style.cssText = `
    background: none;
    border: none;
    color: inherit;
    font-size: 1.4em;
    line-height: 1;
    margin-left: 12px;
    padding: 0 4px;
    cursor: pointer;
    opacity: 0.7;
  `;
  toast.appendChild(closeBtn);

  container.appendChild(toast);

  // Fade in
  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('show'));
  });

  // Dismiss logic
  let dismissTimer = null;
  let dismissed = false;

  const dismiss = () => {
    if (dismissed) return;
    dismissed = true;
    if (dismissTimer) clearTimeout(dismissTimer);
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  };

  const duration = TOAST_DURATIONS[type] ?? 4000;

  const startTimer = () => {
    if (duration > 0) {
      dismissTimer = setTimeout(dismiss, duration);
    }
  };

  const stopTimer = () => {
    if (dismissTimer) {
      clearTimeout(dismissTimer);
      dismissTimer = null;
    }
  };

  // Click toast or × to dismiss
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dismiss();
  });
  toast.addEventListener('click', dismiss);

  // Pause on hover
  toast.addEventListener('mouseenter', stopTimer);
  toast.addEventListener('mouseleave', startTimer);

  startTimer();
}
