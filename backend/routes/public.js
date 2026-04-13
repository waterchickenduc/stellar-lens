'use strict';
const express = require('express');
const router  = express.Router();
const db      = require('../db');

/* GET /public/:token — no auth required */
router.get('/:token', (req, res) => {
  const account = db.prepare(
    'SELECT * FROM game_accounts WHERE public_token = ? AND is_active = 1'
  ).get(req.params.token);
  if (!account) return res.status(404).json({ error: 'Share link not found or disabled' });

  const row = db.prepare(
    'SELECT * FROM snapshots WHERE account_id = ? ORDER BY fetched_at DESC LIMIT 1'
  ).get(account.id);
  if (!row) return res.status(404).json({ error: 'No data available yet' });

  res.json({
    display_name: account.display_name,
    fetched_at:   row.fetched_at,
    data:         JSON.parse(row.raw_json),
  });
});

module.exports = router;
