/* api.js — shared auth-aware fetch wrapper */
function getToken() {
  return localStorage.getItem('stellar_token');
}

function getUser() {
  const raw = localStorage.getItem('stellar_user');
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}

function clearSession() {
  localStorage.removeItem('stellar_token');
  localStorage.removeItem('stellar_user');
}

async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(path, { ...options, headers });
  } catch (networkErr) {
    throw new Error('Network error — is the server running?');
  }

  if (res.status === 401) {
    clearSession();
    window.location.href = '/login.html';
    return;
  }

  let data;
  try { data = await res.json(); } catch { data = {}; }

  if (!res.ok) {
    throw new Error(data.error || data.message || `HTTP ${res.status}`);
  }

  return data;
}

/* ── Backwards-compatibility shim for admin pages ── */
const API = {
  getToken:   () => localStorage.getItem('stellar_token'),
  setToken:   (token) => localStorage.setItem('stellar_token', token),
  clearToken: () => { localStorage.removeItem('stellar_token'); localStorage.removeItem('stellar_user'); },
  getUser:    () => { const r = localStorage.getItem('stellar_user'); try { return r ? JSON.parse(r) : null; } catch { return null; } },
  get:    (path)        => apiFetch('/api' + path),
  post:   (path, body)  => apiFetch('/api' + path, { method: 'POST',   body: JSON.stringify(body || {}) }),
  delete: (path)        => apiFetch('/api' + path, { method: 'DELETE' }),
};

/* patch: setUser */
API.setUser = (user) => localStorage.setItem('stellar_user', JSON.stringify(user));
