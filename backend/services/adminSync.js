'use strict';
const bcrypt = require('bcryptjs');
const db     = require('../db');
const config = require('../config');

async function syncAdmin() {
  const email    = config.adminEmail;
  const password = config.adminPassword;

  if (!email || !password) {
    console.warn('[adminSync] ADMIN_EMAIL or ADMIN_PASSWORD not set in .env — skipping');
    return;
  }

  const hash     = await bcrypt.hash(password, 10);
  const existing = db.prepare("SELECT * FROM users WHERE role = 'admin'").get();

  if (!existing) {
    db.prepare(
      "INSERT INTO users (email, password_hash, role, confirmed) VALUES (?, ?, 'admin', 1)"
    ).run(email, hash);
    console.log('[adminSync] Admin account created:', email);
  } else {
    db.prepare(
      "UPDATE users SET email = ?, password_hash = ?, confirmed = 1 WHERE role = 'admin'"
    ).run(email, hash);
    console.log('[adminSync] Admin account synced:', email);
  }
}

module.exports = { syncAdmin };
