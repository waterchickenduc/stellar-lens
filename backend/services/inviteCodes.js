'use strict';
const crypto = require('crypto');
const db     = require('../db');
const config = require('../config');

function generateCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

function createInviteCode(createdBy, maxUses = 0) {
  const code    = generateCode();
  const days    = config.inviteCodeExpiryDays || 30;
  const expires = new Date();
  expires.setDate(expires.getDate() + days);
  db.prepare(
    'INSERT INTO invite_codes (code, created_by, expires_at, max_uses, use_count) VALUES (?, ?, ?, ?, 0)'
  ).run(code, createdBy, expires.toISOString(), maxUses);
  return code;
}

function validateInviteCode(code) {
  if (!code) return null;
  return db.prepare(`
    SELECT * FROM invite_codes
    WHERE code = ?
      AND expires_at > datetime('now')
      AND (max_uses = 0 OR use_count < max_uses)
  `).get(code.trim().toUpperCase()) || null;
}

function markInviteCodeUsed(code) {
  db.prepare(`
    UPDATE invite_codes
    SET use_count = use_count + 1,
        used_at   = datetime('now')
    WHERE code = ?
  `).run(code.trim().toUpperCase());
}

function listInviteCodes() {
  return db.prepare(`
    SELECT
      ic.id, ic.code, ic.created_by, ic.expires_at, ic.created_at,
      ic.used_at, ic.max_uses, ic.use_count,
      u.email AS used_by_email
    FROM invite_codes ic
    LEFT JOIN users u ON ic.used_by_user_id = u.id
    ORDER BY ic.created_at DESC
  `).all();
}

function deleteExpiredCodes() {
  const r = db.prepare(`
    DELETE FROM invite_codes
    WHERE expires_at < datetime('now')
       OR (max_uses > 0 AND use_count >= max_uses)
  `).run();
  return r.changes;
}

module.exports = {
  createInviteCode,
  validateInviteCode,
  markInviteCodeUsed,
  listInviteCodes,
  deleteExpiredCodes,
};
