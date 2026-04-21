//  backend/routes/public.js
'use strict';
const express = require('express');
const router  = express.Router();
const db      = require('../db');

const ALL_TABS = ['overview', 'planet', 'research', 'performance', 'highscore'];

function buildPayload(account) {
  const row = db.prepare(
    'SELECT * FROM snapshots WHERE account_id = ? ORDER BY fetched_at DESC LIMIT 1'
  ).get(account.id);
  if (!row) return null;

  let allowed_tabs = ALL_TABS;
  if (account.public_tabs) {
    try {
      const parsed = JSON.parse(account.public_tabs);
      if (Array.isArray(parsed) && parsed.length)
        allowed_tabs = parsed.filter(t => ALL_TABS.includes(t));
    } catch (_) {}
  }

  const hours = account.public_history_hours || 1;
  const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();
  const historyRows = db.prepare(
    'SELECT fetched_at, raw_json FROM snapshots WHERE account_id = ? AND fetched_at >= ? ORDER BY fetched_at ASC'
  ).all(account.id, since);
  const history = historyRows.map(r => ({
    fetched_at: r.fetched_at,
    data: JSON.parse(r.raw_json),
  }));

  return {
    display_name:         account.display_name,
    fetched_at:           row.fetched_at,
    allowed_tabs,
    public_history_hours: hours,
    data:                 JSON.parse(row.raw_json),
    history,
  };
}

/* GET /api/public/demo — no auth, returns the designated demo account */
router.get('/demo', (req, res) => {
  const account = db.prepare(
    'SELECT * FROM game_accounts WHERE is_demo = 1 AND is_active = 1'
  ).get();
  if (!account) return res.status(404).json({ error: 'No demo configured' });
  const payload = buildPayload(account);
  if (!payload) return res.status(404).json({ error: 'No data available yet' });
  res.json(payload);
});

/* GET /api/public/:token — shared link */
router.get('/:token', (req, res) => {
  const account = db.prepare(
    'SELECT * FROM game_accounts WHERE public_token = ? AND is_active = 1'
  ).get(req.params.token);
  if (!account) return res.status(404).json({ error: 'Share link not found or disabled' });
  const payload = buildPayload(account);
  if (!payload) return res.status(404).json({ error: 'No data available yet' });
  res.json(payload);
});

module.exports = router;
