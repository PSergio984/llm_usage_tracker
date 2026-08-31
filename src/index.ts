import { createApp } from './app.js';
import { env } from './config/env.js';
import { ensureAlertsTable, checkAlerts } from './jobs/alerts.js';
import { runReconciliation } from './jobs/reconciliation.js';

const app = createApp();

app.listen(env.PORT, async () => {
  console.log(`[server] listening on http://localhost:${env.PORT}`);
  console.log(`[env] DATABASE_URL=${env.DATABASE_URL}`);
  console.log(`[stripe] webhook endpoint http://localhost:${env.PORT}/webhooks/stripe (raw body)`);

  // ≥1 background job off request path per req #3 — 5m alerts + 2am reconciliation
  // Uses pg_try_advisory_xact_lock inside jobs for single-runner, retries + failure log via job_runs
  try {
    await ensureAlertsTable();
    console.log('[jobs] alerts table ensured');
  } catch (e) {
    console.error('[jobs] ensure table failed', e);
  }

  // Alerts every 5 minutes (node-cron would be * /5 * * * *; setInterval is $0 equivalent)
  const ALERT_INTERVAL = 5 * 60 * 1000;
  setInterval(() => {
    checkAlerts().catch((e) => console.error('[jobs] checkAlerts failed', e));
  }, ALERT_INTERVAL).unref();

  // Reconciliation nightly at 2am UTC — compute ms until next 02:00, then 24h interval
  function msUntilNext2amUTC(): number {
    const now = new Date();
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getDate(), 2, 0, 0, 0));
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
    return next.getTime() - now.getTime();
  }
  setTimeout(() => {
    runReconciliation(false).catch((e) => console.error('[jobs] reconciliation failed', e));
    setInterval(() => runReconciliation(false).catch((e) => console.error('[jobs] reconciliation interval failed', e)), 24 * 60 * 60 * 1000).unref();
  }, msUntilNext2amUTC()).unref();

  console.log(`[jobs] background jobs scheduled — alerts ${ALERT_INTERVAL / 1000}s, next reconciliation in ${Math.round(msUntilNext2amUTC() / 1000)}s`);

  // Health reflects last job runs via GET /health? (stub — real health would query job_runs)
});
