// ─────────────────────────────────────────
//  backend/db/index.js
//  Opens and returns the SQLite database connection.
//  All other files import db from here — never open
//  their own connection.
// ─────────────────────────────────────────
'use strict';

const BetterSqlite3 = require('better-sqlite3');
const path          = require('path');
const config        = require('../config');

// Ensure the data directory exists
const fs = require('fs');
const dir = path.dirname(config.dbPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

// Open the database (creates the file if it doesn't exist)
const db = new BetterSqlite3(config.dbPath);

// Performance settings
db.pragma('journal_mode = WAL');   // Better concurrent read performance
db.pragma('foreign_keys = ON');    // Enforce foreign key constraints

module.exports = db;
