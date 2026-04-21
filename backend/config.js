// ─────────────────────────────────────────
//  backend/config.js
//  Reads .env and exports a single config object.
//  Every other file imports from here — never process.env directly.
// ─────────────────────────────────────────
'use strict';

require('dotenv').config();

function required(key) {
  const value = process.env[key];
  if (!value) {
    console.error(`[config] FATAL: Missing required environment variable: ${key}`);
    process.exit(1);
  }
  return value;
}

function optional(key, defaultValue = '') {
  return process.env[key] || defaultValue;
}

const config = {
  port:         parseInt(optional('PORT', '3000'), 10),
  jwtSecret:    required('JWT_SECRET'),
  jwtExpiresIn: optional('JWT_EXPIRES_IN', '7d'),
  adminEmail:    required('ADMIN_EMAIL'),
  adminPassword: required('ADMIN_PASSWORD'),
  dbPath: optional('DB_PATH', '/app/data/stellar.db'),
  smtp: {
    enabled: !!optional('SMTP_HOST'),
    host:    optional('SMTP_HOST'),
    port:    parseInt(optional('SMTP_PORT', '465'), 10),
    user:    optional('SMTP_USER'),
    pass:    optional('SMTP_PASS'),
    from:    optional('SMTP_FROM'),
  },
  appUrl:               optional('APP_URL', 'http://localhost:8080'),
  inviteCodeExpiryDays: parseInt(optional('INVITE_CODE_EXPIRY_DAYS', '30'), 10),
  isDev: optional('NODE_ENV', 'production') === 'development',
};

module.exports = config;
