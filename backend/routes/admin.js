//  backend/routes/admin.js
'use strict';
const express = require('express');
const bcrypt  = require('bcryptjs');

const db              = require('../db');
const { requireAuth } = require('../middleware/auth');
const { adminOnly }   = require('../middleware/adminOnly');

const router = express.Router();

router.use(requireAuth, adminOnly);

// ── USERS ─────────────────────────────────────────────────────

router.get('/users', (req, res) => {
  const users = db.prepare(`
    SELECT id, email, role, confirmed, created_at
    FROM users ORDER BY created_at DESC
  `).all();
  res.json({ users });
});

router.get('/users/:id', (req, res) => {
  const user = db.prepare(
    'SELECT id, email, role, confirmed, created_at FROM users WHERE id = ?'
  ).get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

router.post('/users/:id/confirm', (req, res) => {
  const r = db.prepare('UPDATE users SET confirmed = 1 WHERE id = ?').run(req.params.id);
  if (!r.changes) return res.status(404).json({ error: 'User not found' });
  res.json({ ok: true, message: 'User confirmed' });
});

router.post('/users/:id/set-password', async (req, res) => {
  const { newPassword } = req.body || {};
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'newPassword must be at least 8 characters' });
  }

  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const hash = await bcrypt.hash(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.params.id);

  res.json({ ok: true, message: 'Password updated' });
});

router.post('/users/:id/set-email', (req, res) => {
  const { newEmail } = req.body || {};
  if (!newEmail) return res.status(400).json({ error: 'newEmail is required' });

  const norm  = newEmail.trim().toLowerCase();
  const user  = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const taken = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(norm, req.params.id);
  if (taken) return res.status(400).json({ error: 'Email already in use' });

  db.prepare('UPDATE users SET email = ? WHERE id = ?').run(norm, req.params.id);
  res.json({ ok: true, message: 'Email updated' });
});

router.post('/users/:id/set-role', (req, res) => {
  const { role } = req.body || {};
  if (!['user', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'role must be "user" or "admin"' });
  }
  if (Number(req.params.id) === req.user.id && role !== 'admin') {
    return res.status(400).json({ error: 'You cannot demote yourself' });
  }

  const r = db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
  if (!r.changes) return res.status(404).json({ error: 'User not found' });

  res.json({ ok: true, message: `Role set to ${role}` });
});

router.delete('/users/:id', (req, res) => {
  if (Number(req.params.id) === req.user.id) {
    return res.status(400).json({ error: 'You cannot delete yourself' });
  }

  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const accounts = db.prepare('SELECT id FROM game_accounts WHERE user_id = ?').all(req.params.id);
  accounts.forEach(a => db.prepare('DELETE FROM snapshots WHERE account_id = ?').run(a.id));

  db.prepare('DELETE FROM game_accounts WHERE user_id = ?').run(req.params.id);
  db.prepare('DELETE FROM email_tokens WHERE user_id = ?').run(req.params.id);
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);

  res.json({ ok: true, message: 'User deleted' });
});

// ── STATS ─────────────────────────────────────────────────────

router.get('/stats', (req, res) => {
  const totalUsers     = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  const confirmedUsers = db.prepare('SELECT COUNT(*) AS n FROM users WHERE confirmed = 1').get().n;
  const totalAccounts  = db.prepare('SELECT COUNT(*) AS n FROM game_accounts').get().n;
  const totalSnapshots = db.prepare('SELECT COUNT(*) AS n FROM snapshots').get().n;

  res.json({ totalUsers, confirmedUsers, totalAccounts, totalSnapshots });
});

// ── SETTINGS ──────────────────────────────────────────────────

router.get('/settings', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  rows.forEach(r => { settings[r.key] = r.value; });
  res.json({ settings });
});

router.post('/settings', (req, res) => {
  const { key, value } = req.body || {};
  if (!key || value === undefined) {
    return res.status(400).json({ error: 'key and value required' });
  }

  const allowed = ['pull_interval_minutes'];
  if (!allowed.includes(key)) {
    return res.status(400).json({ error: 'Unknown setting' });
  }

  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, String(value));
  res.json({ ok: true, key, value });
});

// ── DEMO ACCOUNT ──────────────────────────────────────────────

router.get('/accounts', (req, res) => {
  const accounts = db.prepare(`
    SELECT ga.id, ga.display_name, ga.api_url, ga.is_active, ga.is_demo, u.email AS user_email
    FROM game_accounts ga
    JOIN users u ON ga.user_id = u.id
    ORDER BY u.email, ga.display_name
  `).all();
  res.json({ accounts });
});

router.get('/demo', (req, res) => {
  const demo = db.prepare(
    'SELECT id, display_name, api_url, is_active FROM game_accounts WHERE is_demo = 1'
  ).get();
  res.json({ demo: demo || null });
});

router.post('/demo', (req, res) => {
  const { account_id, api_url } = req.body || {};

  db.prepare('UPDATE game_accounts SET is_demo = 0').run();

  if (account_id) {
    const acc = db.prepare('SELECT id FROM game_accounts WHERE id = ?').get(account_id);
    if (!acc) return res.status(404).json({ error: 'Account not found' });

    db.prepare('UPDATE game_accounts SET is_demo = 1 WHERE id = ?').run(account_id);

    if (api_url && api_url.trim()) {
      db.prepare('UPDATE game_accounts SET api_url = ? WHERE id = ?')
        .run(api_url.trim(), account_id);
    }
  }

  res.json({ ok: true });
});

module.exports = router;