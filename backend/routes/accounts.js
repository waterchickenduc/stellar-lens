'use strict';
const express           = require('express');
const router            = express.Router();
const db                = require('../db');
const { requireAuth }   = require('../middleware/auth');
const { fetchAndStore } = require('../services/poller');

const getOwned = (id, userId) =>
  db.prepare('SELECT * FROM game_accounts WHERE id = ? AND user_id = ?').get(id, userId);

/* GET /api/accounts */
router.get('/', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT
      ga.*,
      (SELECT fetched_at FROM snapshots
       WHERE account_id = ga.id
       ORDER BY fetched_at DESC LIMIT 1) AS last_snapshot_at
    FROM game_accounts ga
    WHERE ga.user_id = ?
    ORDER BY ga.created_at ASC
  `).all(req.user.id);
  res.json(rows);
});

/* POST /api/accounts */
router.post('/', requireAuth, (req, res) => {
  const { display_name, api_url } = req.body;
  if (!display_name || !api_url) {
    return res.status(400).json({ error: 'display_name and api_url are required' });
  }
  const { lastInsertRowid } = db.prepare(
    'INSERT INTO game_accounts (user_id, display_name, api_url, is_active) VALUES (?,?,?,1)'
  ).run(req.user.id, display_name.trim(), api_url.trim());
  res.status(201).json(
    db.prepare('SELECT * FROM game_accounts WHERE id = ?').get(lastInsertRowid)
  );
});

/* PATCH /api/accounts/:id */
router.patch('/:id', requireAuth, (req, res) => {
  const account = getOwned(req.params.id, req.user.id);
  if (!account) return res.status(404).json({ error: 'Account not found' });

  const cols = [];
  const vals = [];
  if (req.body.display_name !== undefined) { cols.push('display_name = ?'); vals.push(req.body.display_name.trim()); }
  if (req.body.api_url      !== undefined) { cols.push('api_url = ?');      vals.push(req.body.api_url.trim()); }
  if (req.body.is_active    !== undefined) { cols.push('is_active = ?');    vals.push(req.body.is_active ? 1 : 0); }

  if (cols.length > 0) {
    vals.push(req.params.id);
    db.prepare(`UPDATE game_accounts SET ${cols.join(', ')} WHERE id = ?`).run(...vals);
  }
  res.json(db.prepare('SELECT * FROM game_accounts WHERE id = ?').get(req.params.id));
});

/* DELETE /api/accounts/:id */
router.delete('/:id', requireAuth, (req, res) => {
  const account = getOwned(req.params.id, req.user.id);
  if (!account) return res.status(404).json({ error: 'Account not found' });
  db.prepare('DELETE FROM snapshots     WHERE account_id = ?').run(req.params.id);
  db.prepare('DELETE FROM game_accounts WHERE id         = ?').run(req.params.id);
  res.json({ ok: true });
});

/* POST /api/accounts/:id/fetch */
router.post('/:id/fetch', requireAuth, async (req, res) => {
  const account = getOwned(req.params.id, req.user.id);
  if (!account) return res.status(404).json({ error: 'Account not found' });
  try {
    const { fetched_at } = await fetchAndStore(account);
    res.json({ ok: true, fetched_at });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

/* GET /api/accounts/:id/snapshot */
router.get('/:id/snapshot', requireAuth, (req, res) => {
  if (!getOwned(req.params.id, req.user.id)) return res.status(404).json({ error: 'Account not found' });
  const row = db.prepare(
    'SELECT * FROM snapshots WHERE account_id = ? ORDER BY fetched_at DESC LIMIT 1'
  ).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'No snapshot yet — trigger a fetch first' });
  res.json({ snapshot_id: row.id, fetched_at: row.fetched_at, data: JSON.parse(row.raw_json) });
});

/* GET /api/accounts/:id/snapshots */
router.get('/:id/snapshots', requireAuth, (req, res) => {
  if (!getOwned(req.params.id, req.user.id)) return res.status(404).json({ error: 'Account not found' });
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const rows  = db.prepare(
    'SELECT id, fetched_at FROM snapshots WHERE account_id = ? ORDER BY fetched_at DESC LIMIT ?'
  ).all(req.params.id, limit);
  res.json(rows);
});

/* GET /api/accounts/:id/snapshots/:sid */
router.get('/:id/snapshots/:sid', requireAuth, (req, res) => {
  if (!getOwned(req.params.id, req.user.id)) return res.status(404).json({ error: 'Account not found' });
  const row = db.prepare(
    'SELECT * FROM snapshots WHERE id = ? AND account_id = ?'
  ).get(req.params.sid, req.params.id);
  if (!row) return res.status(404).json({ error: 'Snapshot not found' });
  res.json({ snapshot_id: row.id, fetched_at: row.fetched_at, data: JSON.parse(row.raw_json) });
});

module.exports = router;

/* POST /api/accounts/:id/share — enable public sharing */
router.post('/:id/share', requireAuth, (req, res) => {
  const account = getOwned(req.params.id, req.user.id);
  if (!account) return res.status(404).json({ error: 'Account not found' });
  const token = require('crypto').randomBytes(16).toString('hex');
  db.prepare('UPDATE game_accounts SET public_token = ? WHERE id = ?').run(token, req.params.id);
  res.json({ public_token: token });
});

/* DELETE /api/accounts/:id/share — revoke public sharing */
router.delete('/:id/share', requireAuth, (req, res) => {
  const account = getOwned(req.params.id, req.user.id);
  if (!account) return res.status(404).json({ error: 'Account not found' });
  db.prepare('UPDATE game_accounts SET public_token = NULL WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});
