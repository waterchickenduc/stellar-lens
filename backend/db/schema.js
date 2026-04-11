// ─────────────────────────────────────────
//  db/schema.js
//  Creates all tables on first boot.
//  Safe to call on every restart — uses
//  CREATE TABLE IF NOT EXISTS everywhere.
// ─────────────────────────────────────────
'use strict';

const db = require('./index');

function initDb() {
  // ── Users ─────────────────────────────
  // One row per dashboard account
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      email        TEXT    NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT   NOT NULL,
      role         TEXT    NOT NULL DEFAULT 'user',  -- 'user' | 'admin'
      confirmed    INTEGER NOT NULL DEFAULT 0,        -- 0 = unconfirmed, 1 = confirmed
      theme        TEXT    NOT NULL DEFAULT 'dark',   -- 'dark' | 'light'
      created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // ── Invite Codes ──────────────────────
  // Required to register. Admin generates them.
  db.exec(`
    CREATE TABLE IF NOT EXISTS invite_codes (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      code            TEXT    NOT NULL UNIQUE,
      created_by      INTEGER NOT NULL REFERENCES users(id),
      used_by_user_id INTEGER REFERENCES users(id),
      used_at         TEXT,
      expires_at      TEXT    NOT NULL,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // ── Email Tokens ──────────────────────
  // Used for email confirmation and password reset
  db.exec(`
    CREATE TABLE IF NOT EXISTS email_tokens (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      token      TEXT    NOT NULL UNIQUE,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type       TEXT    NOT NULL,  -- 'confirm' | 'reset'
      expires_at TEXT    NOT NULL,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // ── Game Accounts ─────────────────────
  // Each user can link multiple game accounts
  db.exec(`
    CREATE TABLE IF NOT EXISTS game_accounts (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      display_name TEXT    NOT NULL,          -- friendly name the user sets
      api_url      TEXT    NOT NULL,          -- full API URL with token
      is_active    INTEGER NOT NULL DEFAULT 1, -- 1 = active, 0 = paused
      last_fetched TEXT,                       -- last successful snapshot time
      last_error   TEXT,                       -- last fetch error message if any
      created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // ── Snapshots ─────────────────────────
  // Every 15 minutes, one row per game account is inserted.
  // raw_json stores the full API response so nothing is ever lost.
  db.exec(`
    CREATE TABLE IF NOT EXISTS snapshots (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL REFERENCES game_accounts(id) ON DELETE CASCADE,
      fetched_at TEXT    NOT NULL DEFAULT (datetime('now')),
      raw_json   TEXT    NOT NULL
    );
  `);

  // ── Indexes for common queries ────────
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_snapshots_account_id
      ON snapshots(account_id);

    CREATE INDEX IF NOT EXISTS idx_snapshots_fetched_at
      ON snapshots(fetched_at);

    CREATE INDEX IF NOT EXISTS idx_game_accounts_user_id
      ON game_accounts(user_id);

    CREATE INDEX IF NOT EXISTS idx_email_tokens_token
      ON email_tokens(token);

    CREATE INDEX IF NOT EXISTS idx_invite_codes_code
      ON invite_codes(code);
  `);

  console.log('[db] All tables and indexes ready');
}

module.exports = { initDb };
