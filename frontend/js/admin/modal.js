// Generic modal helper
const Modal = (() => {
  const overlay = document.getElementById('modal-overlay');
  const title   = document.getElementById('modal-title');
  const sub     = document.getElementById('modal-sub');
  const body    = document.getElementById('modal-body');
  const actions = document.getElementById('modal-actions');

  function open({ titleText, subText = '', bodyHTML = '', buttons = [] }) {
    title.textContent   = titleText;
    sub.textContent     = subText;
    body.innerHTML      = bodyHTML;
    actions.innerHTML   = '';

    buttons.forEach(({ label, cls, onClick }) => {
      const btn = document.createElement('button');
      btn.className   = `btn ${cls || ''}`;
      btn.textContent = label;
      btn.addEventListener('click', () => onClick(btn));
      actions.appendChild(btn);
    });

    overlay.classList.remove('hidden');
    // Focus first input if present
    setTimeout(() => { const inp = body.querySelector('input'); if (inp) inp.focus(); }, 50);
  }

  function close() { overlay.classList.add('hidden'); }

  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  return { open, close };
})();
