'use strict';
const jwt    = require('jsonwebtoken');
const db     = require('../db');
const config = require('../config');

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = header.slice(7);
  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const user = db.prepare(
    'SELECT id, email, role, confirmed FROM users WHERE id = ?'
  ).get(payload.sub);

  if (!user) return res.status(401).json({ error: 'User not found' });

  req.user = user;
  next();
}

module.exports = { requireAuth };
