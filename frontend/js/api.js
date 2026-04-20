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
    const err = new Error('Network error — is the server running?');
    err.status = 0;
    throw err;
  }

  let data;
  try { data = await res.json(); } catch { data = {}; }

  // Only auto-redirect on 401 if we HAD a token (session expired).
  // A 401 on login should be thrown so the login page can show it.
  if (res.status === 401 && token && !path.includes('/auth/login')) {
    clearSession();
    window.location.href = '/index.html';
    // Still throw so the caller doesn't continue with undefined
    const err = new Error(data.error || data.message || 'Session expired');
    err.status = 401;
    err.data   = data;
    throw err;
  }

  if (!res.ok) {
    const err = new Error(data.error || data.message || `HTTP ${res.status}`);
    err.status = res.status;
    err.data   = data;
    throw err;
  }

  return data;
}

/* ── Backwards-compatibility shim for admin pages ── */
const API = {
  getToken:   () => localStorage.getItem('stellar_token'),
  setToken:   (token) => localStorage.setItem('stellar_token', token),
  clearToken: () => { localStorage.removeItem('stellar_token'); localStorage.removeItem('stellar_user'); },
  getUser:    () => { const r = localStorage.getItem('stellar_user'); try { return r ? JSON.parse(r) : null; } catch { return null; } },
  setUser:    (user) => localStorage.setItem('stellar_user', JSON.stringify(user)),
  get:    (path)        => apiFetch('/api' + path),
  post:   (path, body)  => apiFetch('/api' + path, { method: 'POST',   body: JSON.stringify(body || {}) }),
  delete: (path)        => apiFetch('/api' + path, { method: 'DELETE' }),
};
