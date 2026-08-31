import { createApp } from './app.js';
import { env } from './config/env.js';

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`[server] listening on http://localhost:${env.PORT}`);
  console.log(`[env] DATABASE_URL=${env.DATABASE_URL}`);
  console.log(`[stripe] webhook endpoint http://localhost:${env.PORT}/webhooks/stripe (raw body)`);
});
