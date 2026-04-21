//  backend/server.js
'use strict';
const app    = require('./app');
const config = require('./config');
const { initDb }       = require('./db/schema');
const { runMigrations } = require('./db/migrations');
const { syncAdmin }    = require('./services/adminSync');

async function start() {
  // 1. Create tables (safe — uses IF NOT EXISTS)
  initDb();

  // 2. Apply any pending schema migrations
  runMigrations();

  // 3. Sync admin account from .env
  await syncAdmin();

  // 4. Start background poller
  require('./services/poller').startPoller();

  // 5. Start HTTP server
  const port = config.port || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`[server] Stellar Dashboard listening on port ${port}`);
  });
}

start().catch((err) => {
  console.error('[server] Fatal startup error:', err);
  process.exit(1);
});
