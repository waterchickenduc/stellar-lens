// ─────────────────────────────────────────
//  backend/db/migrations.js
//  Handles schema changes after first deploy.
//
//  HOW IT WORKS:
//  - Each migration has a unique integer version number
//  - On boot, we check which versions have already run
//  - Only unrun migrations are applied, in order
//  - Safe to run on every restart
//
//  HOW TO ADD A MIGRATION (future tasks):
//  1. Add a new object to the MIGRATIONS array
//  2. Give it the next version number
//  3. Write the SQL in the `up` function
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
// Add new migrations here as the project grows
const MIGRATIONS = [
  // Example of how to add one later:
  // {
  //   version: 1,
  //   description: 'Add notifications table',
  //   up: (db) => {
  //     db.exec(`CREATE TABLE IF NOT EXISTS notifications (...)`);
  //   }
  // },
];

function runMigrations() {
  const applied = db.prepare('SELECT version FROM _migrations').all()
    .map(r => r.version);

  let count = 0;
  for (const migration of MIGRATIONS) {
    if (applied.includes(migration.version)) continue;

    console.log(`[migrations] Applying v${migration.version}: ${migration.description}`);
    migration.up(db);
    db.prepare('INSERT INTO _migrations (version) VALUES (?)').run(migration.version);
    count++;
  }

  if (count === 0) {
    console.log('[migrations] All up to date');
  } else {
    console.log(`[migrations] Applied ${count} migration(s)`);
  }
}


  // Migration: multi-use invite codes
  try {
    db.prepare('ALTER TABLE invite_codes ADD COLUMN max_uses INTEGER NOT NULL DEFAULT 0').run();
    console.log('[migrations] added invite_codes.max_uses');
  } catch(e) {}
  try {
    db.prepare('ALTER TABLE invite_codes ADD COLUMN use_count INTEGER NOT NULL DEFAULT 0').run();
    console.log('[migrations] added invite_codes.use_count');
  } catch(e) {}


  // Migration: global settings table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `).run();
  // Default pull interval: 15 minutes
  db.prepare(
    "INSERT OR IGNORE INTO settings (key, value) VALUES ('pull_interval_minutes', '15')"
  ).run();
  console.log('[migrations] settings table ready');

module.exports = { runMigrations };
