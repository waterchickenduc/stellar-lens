'use strict';
const cron = require('node-cron');
const db   = require('../db');

const SNAPSHOT_RETENTION = 672; // 7 days at 15-min intervals

// Read pull interval from DB settings
function getPullIntervalMinutes() {
  try {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'pull_interval_minutes'").get();
    const val = parseInt(row?.value) || 15;
    return Math.max(1, Math.min(val, 1440)); // clamp 1min–24hr
  } catch {
    return 15;
  }
}

async function pollAccount(account) {
  try {
    const res = await fetch(account.api_url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const fetched_at = new Date().toISOString();
    db.prepare(
      'INSERT INTO snapshots (account_id, fetched_at, raw_json) VALUES (?,?,?)'
    ).run(account.id, fetched_at, JSON.stringify(data));

    db.prepare(
      'UPDATE game_accounts SET last_fetched = ?, last_error = NULL WHERE id = ?'
    ).run(fetched_at, account.id);

    db.prepare(`
      DELETE FROM snapshots
      WHERE account_id = ?
        AND id NOT IN (
          SELECT id FROM snapshots
          WHERE account_id = ?
          ORDER BY fetched_at DESC
          LIMIT ?
        )
    `).run(account.id, account.id, SNAPSHOT_RETENTION);

    console.log('[poller] OK ' + account.display_name + ' at ' + fetched_at);
  } catch (err) {
    console.error('[poller] FAIL ' + account.display_name + ':', err.message);
    db.prepare(
      'UPDATE game_accounts SET last_error = ? WHERE id = ?'
    ).run(err.message, account.id);
  }
}

async function runPoll() {
  const accounts = db.prepare(
    'SELECT * FROM game_accounts WHERE is_active = 1'
  ).all();
  if (!accounts.length) return;
  console.log(`[poller] Polling ${accounts.length} account(s)...`);
  for (const account of accounts) {
    await pollAccount(account);
  }
}

// Track last poll time in memory
let lastPollTime = 0;

function startPoller() {
  // Run every minute, check internally if enough time has passed
  cron.schedule('* * * * *', async () => {
    const intervalMs = getPullIntervalMinutes() * 60 * 1000;
    const now        = Date.now();
    if (now - lastPollTime >= intervalMs) {
      lastPollTime = now;
      await runPoll();
    }
  });

  // Also run immediately on startup
  runPoll().then(() => { lastPollTime = Date.now(); });

  const interval = getPullIntervalMinutes();
  console.log(`[poller] Started — interval: ${interval} minute(s) (adjustable in admin)`);
}

module.exports = { startPoller, runPoll, getPullIntervalMinutes };
