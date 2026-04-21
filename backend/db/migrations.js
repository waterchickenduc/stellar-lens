// ─────────────────────────────────────────
//  backend/db/migrations.js
//  Handles schema changes after first deploy.
//
//  HOW IT WORKS:
//  - Each migration has a unique integer version number
//  - On boot, we check which versions have already run
//  - Only unrun migrations are applied, in order
//  - Safe to run on every restart
// ─────────────────────────────────────────
'use strict';

const db = require('./index');

// Create the migrations tracking table if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS _migrations (
    version    INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// ── Migration list ────────────────────────
const MIGRATIONS = [
  {
    version: 1,
    description: 'Create settings table and seed default pull interval',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS settings (
          key   TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
      `);

      db.prepare(`
        INSERT OR IGNORE INTO settings (key, value)
        VALUES ('pull_interval_minutes', '15')
      `).run();
    },
  },
  {
    version: 2,
    description: 'Remove legacy invite_codes table',
    up: (db) => {
      db.exec(`
        DROP TABLE IF EXISTS invite_codes;
      `);
    },
  },
];

function runMigrations() {
  const applied = db.prepare('SELECT version FROM _migrations ORDER BY version').all()
    .map(r => r.version);

  let count = 0;

  for (const migration of MIGRATIONS) {
    if (applied.includes(migration.version)) continue;

    console.log(`[migrations] Applying v${migration.version}: ${migration.description}`);

    const tx = db.transaction(() => {
      migration.up(db);
      db.prepare('INSERT INTO _migrations (version) VALUES (?)').run(migration.version);
    });

    tx();
    count++;
  }

  if (count === 0) {
    console.log('[migrations] All up to date');
  } else {
    console.log(`[migrations] Applied ${count} migration(s)`);
  }
}

module.exports = { runMigrations };