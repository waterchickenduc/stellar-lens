// routes/snapshots.js
'use strict';
const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { requireAuth } = require('../middleware/auth');

// GET /api/snapshots/latest/:accountId
// Returns the most recent snapshot + fetched_at and lastSeen from game data
router.get('/latest/:accountId', requireAuth, (req, res) => {
  const accountId = parseInt(req.params.accountId);

  // Make sure this account belongs to the requesting user
  const account = db.prepare(
    'SELECT * FROM game_accounts WHERE id = ? AND user_id = ?'
  ).get(accountId, req.user.id);

  if (!account) return res.status(404).json({ error: 'Account not found' });

  const snapshot = db.prepare(
    'SELECT id, fetched_at, raw_json FROM snapshots WHERE account_id = ? ORDER BY fetched_at DESC LIMIT 1'
  ).get(accountId);

  if (!snapshot) return res.status(404).json({ error: 'No snapshots yet' });

  let parsed = null;
  try { parsed = JSON.parse(snapshot.raw_json); } catch { /* keep null */ }

  return res.json({
    snapshotId:   snapshot.id,
    fetchedAt:    snapshot.fetched_at,   // when OUR poller pulled it
    lastSeen:     parsed?.lastSeen ?? null, // when the player was last in-game
    accountName:  account.display_name,
    lastError:    account.last_error ?? null,
    data:         parsed
  });
});

// GET /api/snapshots/status/:accountId
// Lightweight — just timestamps, no full data payload
router.get('/status/:accountId', requireAuth, (req, res) => {
  const accountId = parseInt(req.params.accountId);

  const account = db.prepare(
    'SELECT * FROM game_accounts WHERE id = ? AND user_id = ?'
  ).get(accountId, req.user.id);

  if (!account) return res.status(404).json({ error: 'Account not found' });

  const snapshot = db.prepare(
    'SELECT fetched_at, raw_json FROM snapshots WHERE account_id = ? ORDER BY fetched_at DESC LIMIT 1'
  ).get(accountId);

  if (!snapshot) {
    return res.json({
      fetchedAt:  null,
      lastSeen:   null,
      lastError:  account.last_error ?? null,
      isStale:    true,
      staleReason: 'No snapshots recorded yet'
    });
  }

  let lastSeen = null;
  try {
    const parsed = JSON.parse(snapshot.raw_json);
    lastSeen = parsed?.lastSeen ?? null;
  } catch { /* ignore */ }

  const fetchedAt     = new Date(snapshot.fetched_at);
  const ageMinutes    = (Date.now() - fetchedAt.getTime()) / 60000;
  const isStale       = ageMinutes > 30;
  const staleReason   = isStale
    ? `Last pull was ${Math.round(ageMinutes)} minutes ago — poller may be stuck`
    : null;

  return res.json({
    fetchedAt:   snapshot.fetched_at,
    lastSeen:    lastSeen,
    lastError:   account.last_error ?? null,
    ageMinutes:  Math.round(ageMinutes),
    isStale:     isStale,
    staleReason: staleReason
  });
});

// GET /api/snapshots/history/:accountId?limit=96
// Returns list of past snapshots (for performance graphs)
router.get('/history/:accountId', requireAuth, (req, res) => {
  const accountId = parseInt(req.params.accountId);
  const limit     = Math.min(parseInt(req.query.limit) || 96, 672); // max 7 days

  const account = db.prepare(
    'SELECT id FROM game_accounts WHERE id = ? AND user_id = ?'
  ).get(accountId, req.user.id);

  if (!account) return res.status(404).json({ error: 'Account not found' });

  const rows = db.prepare(
    'SELECT id, fetched_at, raw_json FROM snapshots WHERE account_id = ? ORDER BY fetched_at DESC LIMIT ?'
  ).all(accountId, limit);

  const history = rows.map(row => {
    let parsed = null;
    try { parsed = JSON.parse(row.raw_json); } catch { /* skip */ }
    return {
      snapshotId:    row.id,
      fetchedAt:     row.fetched_at,
      globalPoints:  parsed?.globalPoints  ?? null,
      militaryPoints: parsed?.militaryPoints ?? null,
      economyPoints: parsed?.economyPoints  ?? null,
      researchPoints: parsed?.researchPoints ?? null,
      defensePoints: parsed?.defensePoints  ?? null,
      level:         parsed?.level          ?? null,
      lastSeen:      parsed?.lastSeen       ?? null
    };
  });

  return res.json({ accountId, history });
});

module.exports = router;
