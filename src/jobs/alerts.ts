import { pool } from '../db/pool.js';

/**
 * Alerts at 80% and 100% per tenant+period per ADR 0006.
 * Node-cron `* /5 * * * *` is set up in src/index.ts (not here) to call `checkAlerts()`.
 * Dedup via unique(tenant_id, period_start, threshold) in usage_alerts.
 * For capstone $0, delivery is console + in-app flag in GET /usage (Notifier interface).
 */

export async function checkAlerts() {
  // advisory lock to ensure single runner across scaled instances
  const client = await pool.connect();
  try {
    const lockKey = 0x616c657274; // 'alert'
    const { rows: lockRows } = await client.query(`SELECT pg_try_advisory_xact_lock($1) as locked`, [lockKey]);
    if (!lockRows[0]?.locked) return;

    const periodStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString().slice(0, 10);
    const { rows: tenants } = await client.query(`SELECT id FROM tenants`);
    for (const t of tenants) {
      const tenantId = t.id as string;
      // get plan limits
      const { rows: subRows } = await client.query(`SELECT plan_code FROM subscriptions WHERE tenant_id=$1 AND status='active' LIMIT 1`, [tenantId]);
      const plan: 'free' | 'pro' = (subRows[0]?.plan_code as any) ?? 'free';
      const { rows: planRows } = await client.query(`SELECT api_quota, token_quota FROM plans WHERE code=$1`, [plan]);
      if (planRows.length === 0) continue;
      const { api_quota, token_quota } = planRows[0];

      for (const [type, limit] of [
        ['api_call', api_quota],
        ['ai_tokens', token_quota],
      ] as const) {
        const { rows: sumRows } = await client.query(
          `SELECT COALESCE(SUM(quantity),0)::int as sum FROM usage_events WHERE tenant_id=$1 AND type=$2 AND billing_period_start=$3::date`,
          [tenantId, type, periodStart]
        );
        const used = Number(sumRows[0].sum);
        const pct = limit > 0 ? (used / limit) * 100 : 0;
        for (const threshold of [80, 100] as const) {
          if (pct >= threshold) {
            try {
              await client.query(
                `INSERT INTO usage_alerts (tenant_id, period_start, threshold, channel) VALUES ($1,$2::date,$3,'console') ON CONFLICT (tenant_id, period_start, threshold) DO NOTHING`,
                [tenantId, periodStart, threshold]
              );
              // In real impl, dispatch via Notifier here (console + in-app)
              console.log(`[alert] tenant ${tenantId} ${type} ${used}/${limit} crossed ${threshold}% for ${periodStart}`);
            } catch {}
          }
        }
      }
    }
  } finally {
    client.release();
  }
}

// Minimal table creation for alerts if not in migrations (lazy ensure)
export async function ensureAlertsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usage_alerts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      period_start DATE NOT NULL,
      threshold INTEGER NOT NULL CHECK (threshold IN (80,100)),
      channel TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (tenant_id, period_start, threshold)
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS job_runs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      finished_at TIMESTAMPTZ,
      status TEXT NOT NULL,
      error TEXT
    );
  `);
}
