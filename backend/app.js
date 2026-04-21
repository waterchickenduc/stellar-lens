//  backend/app.js
'use strict';
const express = require('express');
const helmet  = require('helmet');
const cors    = require('cors');
const path    = require('path');
const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'frontend')));
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/accounts',  require('./routes/accounts'));
app.use('/api/accounts',  require('./routes/history'));
app.use('/api/snapshots', require('./routes/snapshots'));
app.use('/api/admin',     require('./routes/admin'));
app.use('/api/public',    require('./routes/public'));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});
app.use((err, _req, res, _next) => {
  console.error('[error]', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});
module.exports = app;
