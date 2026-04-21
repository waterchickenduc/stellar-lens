//  backend/routes/auth.js
'use strict';
const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const crypto  = require('crypto');

const db     = require('../db');
const config = require('../config');
const { requireAuth }                            = require('../middleware/auth');
const { validateInviteCode, markInviteCodeUsed } = require('../services/inviteCodes');
const { sendConfirmationEmail, smtpEnabled }     = require('../services/mailer');

const router = express.Router();

function makeJwt(user) {
  return jwt.sign(
    { sub: user.id, role: user.role },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn || '7d' }
  );
}

function saveEmailToken(userId, type, hoursValid = 24) {
  const token   = crypto.randomBytes(32).toString('hex');
  const expires = new Date();
  expires.setHours(expires.getHours() + hoursValid);
  db.prepare(
    'INSERT INTO email_tokens (token, user_id, type, expires_at) VALUES (?, ?, ?, ?)'
  ).run(token, userId, type, expires.toISOString());
  return token;
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { email, password, inviteCode } = req.body || {};

  if (!email || !password || !inviteCode) {
    return res.status(400).json({ error: 'email, password and inviteCode are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const invite = validateInviteCode(inviteCode);
  if (!invite) {
    return res.status(400).json({ error: 'Invalid or expired invite code' });
  }

  const norm     = email.trim().toLowerCase();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(norm);
  if (existing) {
    return res.status(400).json({ error: 'Email is already registered' });
  }

  const hash   = await bcrypt.hash(password, 10);
  const result = db.prepare(
    "INSERT INTO users (email, password_hash, role, confirmed) VALUES (?, ?, 'user', 0)"
  ).run(norm, hash);
  const userId = result.lastInsertRowid;

  markInviteCodeUsed(inviteCode);

  const token = saveEmailToken(userId, 'confirm', 24);
  try {
    await sendConfirmationEmail(norm, token);
  } catch (err) {
    console.error('[auth/register] mailer error:', err.message);
  }

  const resp = {
    ok: true,
    message: smtpEnabled
      ? 'Registration successful. Check your email to confirm your account.'
      : 'Registration successful. SMTP is disabled — use the confirm link below.',
  };
  if (!smtpEnabled) {
    resp.confirmLink = `${config.appUrl}/confirm.html?token=${token}`;
  }
  res.json(resp);
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  if (!user.confirmed) {
    return res.status(403).json({
      error: 'Please confirm your email before logging in',
      unconfirmed: true,
    });
  }

  res.json({
    token: makeJwt(user),
    user: { id: user.id, email: user.email, role: user.role },
  });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// GET /api/auth/confirm/:token
router.get('/confirm/:token', (req, res) => {
  const { token } = req.params;

  const record = db.prepare(`
    SELECT * FROM email_tokens
    WHERE token = ? AND type = 'confirm' AND expires_at > datetime('now')
  `).get(token);

  if (!record) {
    return res.status(400).json({ error: 'Invalid or expired confirmation link' });
  }

  db.prepare('UPDATE users SET confirmed = 1 WHERE id = ?').run(record.user_id);
  db.prepare('DELETE FROM email_tokens WHERE token = ?').run(token);

  res.json({ ok: true, message: 'Email confirmed! You can now log in.' });
});

// POST /api/auth/resend-confirm
router.post('/resend-confirm', async (req, res) => {
  const generic = {
    ok: true,
    message: 'If that email exists and is unconfirmed, a new link was sent.',
  };

  const { email } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email?.trim().toLowerCase());

  if (!user || user.confirmed) return res.json(generic);

  db.prepare("DELETE FROM email_tokens WHERE user_id = ? AND type = 'confirm'").run(user.id);
  const token = saveEmailToken(user.id, 'confirm', 24);

  try {
    await sendConfirmationEmail(user.email, token);
  } catch (err) {
    console.error('[auth/resend-confirm] mailer error:', err.message);
  }

  if (!smtpEnabled) {
    generic.confirmLink = `${config.appUrl}/confirm.html?token=${token}`;
  }
  res.json(generic);
});

// POST /api/auth/change-password
router.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword and newPassword are required' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }

  const user  = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const valid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

  const hash = await bcrypt.hash(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.user.id);

  res.json({ ok: true, message: 'Password updated successfully' });
});

// POST /api/auth/change-email
router.post('/change-email', requireAuth, async (req, res) => {
  const { newEmail, password } = req.body || {};

  if (!newEmail || !password) {
    return res.status(400).json({ error: 'newEmail and password are required' });
  }

  const norm  = newEmail.trim().toLowerCase();
  const user  = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Password is incorrect' });

  const taken = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(norm, req.user.id);
  if (taken) return res.status(400).json({ error: 'That email is already in use' });

  db.prepare('UPDATE users SET email = ?, confirmed = 0 WHERE id = ?').run(norm, req.user.id);

  const token = saveEmailToken(req.user.id, 'confirm', 24);
  try {
    await sendConfirmationEmail(norm, token);
  } catch (err) {
    console.error('[auth/change-email] mailer error:', err.message);
  }

  const resp = {
    ok: true,
    message: smtpEnabled
      ? 'Email updated. Please confirm your new address.'
      : 'Email updated. Confirm via the link below.',
  };
  if (!smtpEnabled) {
    resp.confirmLink = `${config.appUrl}/confirm.html?token=${token}`;
  }
  res.json(resp);
});

module.exports = router;
