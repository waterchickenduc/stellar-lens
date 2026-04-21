//  backend/routes/highscore.js
const express = require('express');
const router  = express.Router();
const { requireAuth } = require('../middleware/auth');
const db = require('../db');

router.get('/:id/history', requireAuth, (req, res) => {
  const accountId = parseInt(req.params.id);
  const limit     = Math.min(parseInt(req.query.limit) || 500, 672);

  const prepare = (sql) => db.prepare ? db.prepare(sql) : db.db.prepare(sql);

  const account = prepare(
    'SELECT id FROM game_accounts WHERE id = ? AND user_id = ?'
  ).get(accountId, req.user.id);

  if (!account) return res.status(404).json({ error: 'Account not found' });

  // DESC so we always get the most recent N snapshots,
  // the frontend reverses them to show oldest-left, newest-right
  const snapshots = prepare(
    'SELECT id, fetched_at, raw_json FROM snapshots WHERE account_id = ? ORDER BY fetched_at DESC LIMIT ?'
  ).all(accountId, limit);

  const history = snapshots.map(snap => {
    let d;
    try { d = JSON.parse(snap.raw_json); } catch { return null; }

    let ore = 0, crystal = 0, helium3 = 0;
    (d.coloniesData || []).forEach(col => {
      ore     += col.production?.ore     || 0;
      crystal += col.production?.crystal || 0;
      helium3 += col.production?.helium3 || 0;
    });

    return {
      snapshot_id:          snap.id,
      fetched_at:           snap.fetched_at,
      globalPoints:         d.globalPoints         || 0,
      militaryPoints:       d.militaryPoints        || 0,
      economyPoints:        d.economyPoints         || 0,
      researchPoints:       d.researchPoints        || 0,
      defensePoints:        d.defensePoints         || 0,
      level:                d.level                 || 0,
      xp:                   d.xp                    || 0,
      totalExpeditions:     d.totalExpeditions      || 0,
      totalBattleVictories: d.totalBattleVictories  || 0,
      anomalyLevel:         d.anomalyLevel          || 0,
      ranks:                d.ranks                 || {},
      production:           { ore, crystal, helium3 },
    };
  }).filter(Boolean);

  res.json({ history, count: history.length });
});

module.exports = router;
