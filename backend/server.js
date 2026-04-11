'use strict';
const app    = require('./app');
const config = require('./config');
const { syncAdmin } = require('./services/adminSync');

async function start() {
  await syncAdmin();

  const port = config.port || 3000;
  require('./services/poller').startPoller();
app.listen(port, '0.0.0.0', () => {
    console.log(`[server] Stellar Dashboard listening on port ${port}`);
  });
}

start().catch((err) => {
  console.error('[server] Fatal startup error:', err);
  process.exit(1);
});
