//  backend/routes/accounts.js
'use strict';
const express           = require('express');
const router            = express.Router();
const db                = require('../db');
const { requireAuth }   = require('../middleware/auth');
const { fetchAndStore } = require('../services/poller');

const ALL_TABS    = ['overview', 'planet', 'research', 'performance', 'highscore'];
const VALID_HOURS = [1, 6, 24, 168];

const getOwned = (id, userId) =>
  db.prepare('SELECT * FROM game_accounts WHERE id = ? AND user_id = ?').get(id, userId);

router.get('/', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT ga.*,
      (SELECT fetched_at FROM snapshots WHERE account_id = ga.id
       ORDER BY fetched_at DESC LIMIT 1) AS last_snapshot_at
    FROM game_accounts ga
    WHERE ga.user_id = ?
    ORDER BY ga.created_at ASC
  `).all(req.user.id);
  res.json(rows);
});

router.post('/', requireAuth, (req, res) => {
  const { display_name, api_url } = req.body;
  if (!display_name || !api_url)
    return res.status(400).json({ error: 'display_name and api_url are required' });
  const { lastInsertRowid } = db.prepare(
    'INSERT INTO game_accounts (user_id, display_name, api_url, is_active) VALUES (?,?,?,1)'
  ).run(req.user.id, display_name.trim(), api_url.trim());
  res.status(201).json(db.prepare('SELECT * FROM game_accounts WHERE id = ?').get(lastInsertRowid));
});

router.patch('/:id', requireAuth, (req, res) => {
  const account = getOwned(req.params.id, req.user.id);
  if (!account) return res.status(404).json({ error: 'Account not found' });
  const cols = [], vals = [];
  if (req.body.display_name !== undefined) { cols.push('display_name = ?'); vals.push(req.body.display_name.trim()); }
  if (req.body.api_url      !== undefined) { cols.push('api_url = ?');      vals.push(req.body.api_url.trim()); }
  if (req.body.is_active    !== undefined) { cols.push('is_active = ?');    vals.push(req.body.is_active ? 1 : 0); }
  if (cols.length > 0) {
    vals.push(req.params.id);
    db.prepare(`UPDATE game_accounts SET ${cols.join(', ')} WHERE id = ?`).run(...vals);
  }
  res.json(db.prepare('SELECT * FROM game_accounts WHERE id = ?').get(req.params.id));
});

router.delete('/:id', requireAuth, (req, res) => {
  const account = getOwned(req.params.id, req.user.id);
  if (!account) return res.status(404).json({ error: 'Account not found' });
  db.prepare('DELETE FROM snapshots     WHERE account_id = ?').run(req.params.id);
  db.prepare('DELETE FROM game_accounts WHERE id         = ?').run(req.params.id);
  res.json({ ok: true });
});

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

router.get('/:id/snapshot', requireAuth, (req, res) => {
  if (!getOwned(req.params.id, req.user.id))
    return res.status(404).json({ error: 'Account not found' });
  const row = db.prepare(
    'SELECT * FROM snapshots WHERE account_id = ? ORDER BY fetched_at DESC LIMIT 1'
  ).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'No snapshot yet' });
  res.json({ snapshot_id: row.id, fetched_at: row.fetched_at, data: JSON.parse(row.raw_json) });
});

router.get('/:id/snapshots', requireAuth, (req, res) => {
  if (!getOwned(req.params.id, req.user.id))
    return res.status(404).json({ error: 'Account not found' });
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const rows = db.prepare(
    'SELECT id, fetched_at FROM snapshots WHERE account_id = ? ORDER BY fetched_at DESC LIMIT ?'
  ).all(req.params.id, limit);
  res.json(rows);
});

router.get('/:id/snapshots/:sid', requireAuth, (req, res) => {
  if (!getOwned(req.params.id, req.user.id))
    return res.status(404).json({ error: 'Account not found' });
  const row = db.prepare(
    'SELECT * FROM snapshots WHERE id = ? AND account_id = ?'
  ).get(req.params.sid, req.params.id);
  if (!row) return res.status(404).json({ error: 'Snapshot not found' });
  res.json({ snapshot_id: row.id, fetched_at: row.fetched_at, data: JSON.parse(row.raw_json) });
});

/* POST /api/accounts/:id/share
   ONLY used to CREATE a new share link (generates token for the first time).
   Never call this if a token already exists. */
router.post('/:id/share', requireAuth, (req, res) => {
  const account = getOwned(req.params.id, req.user.id);
  if (!account) return res.status(404).json({ error: 'Account not found' });

  // If already shared, refuse to generate a new token — use PATCH instead
  if (account.public_token) {
    return res.status(400).json({ error: 'Already shared. Use PATCH to update preferences.' });
  }

  const token = require('crypto').randomBytes(16).toString('hex');

  const rawTabs = req.body.tabs;
  const tabs = (Array.isArray(rawTabs) && rawTabs.length)
    ? rawTabs.filter(t => ALL_TABS.includes(t))
    : [...ALL_TABS];
  if (!tabs.length)
    return res.status(400).json({ error: 'At least one tab must be selected.' });

  const rawHours = Number(req.body.history_hours);
  const hours = VALID_HOURS.includes(rawHours) ? rawHours : 1;

  db.prepare('UPDATE game_accounts SET public_token = ?, public_tabs = ?, public_history_hours = ? WHERE id = ?')
    .run(token, JSON.stringify(tabs), hours, req.params.id);

  res.json({ public_token: token, public_tabs: tabs, public_history_hours: hours });
});

/* PATCH /api/accounts/:id/share
   Updates tabs + history_hours WITHOUT touching the token.
   Safe to call at any time when a share link already exists. */
router.patch('/:id/share', requireAuth, (req, res) => {
  const account = getOwned(req.params.id, req.user.id);
  if (!account) return res.status(404).json({ error: 'Account not found' });
  if (!account.public_token) return res.status(404).json({ error: 'No share link exists yet.' });

  const rawTabs = req.body.tabs;
  const tabs = (Array.isArray(rawTabs) && rawTabs.length)
    ? rawTabs.filter(t => ALL_TABS.includes(t))
    : [...ALL_TABS];
  if (!tabs.length)
    return res.status(400).json({ error: 'At least one tab must be selected.' });

  const rawHours = Number(req.body.history_hours);
  const hours = VALID_HOURS.includes(rawHours) ? rawHours : 1;

  // Token is intentionally NOT updated here
  db.prepare('UPDATE game_accounts SET public_tabs = ?, public_history_hours = ? WHERE id = ?')
    .run(JSON.stringify(tabs), hours, req.params.id);

  res.json({ public_token: account.public_token, public_tabs: tabs, public_history_hours: hours });
});

/* DELETE /api/accounts/:id/share — revoke */
router.delete('/:id/share', requireAuth, (req, res) => {
  const account = getOwned(req.params.id, req.user.id);
  if (!account) return res.status(404).json({ error: 'Account not found' });
  db.prepare('UPDATE game_accounts SET public_token = NULL, public_tabs = NULL, public_history_hours = 1 WHERE id = ?')
    .run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
