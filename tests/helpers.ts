import { pool } from '../src/db/pool.js';

export async function cleanDb() {
  // truncate in order respecting FK
  await pool.query(`TRUNCATE usage_events, webhook_events, subscriptions, tenants RESTART IDENTITY CASCADE`);
  // re-seed plans (TRUNCATE cascades? plans not truncated due to FK reference, but ensure)
  await pool.query(
    `INSERT INTO plans (code, name, api_quota, token_quota, price_cents) VALUES
      ('free', 'Free', 1000, 100000, 0),
      ('pro', 'Pro', 10000, 1000000, 1500)
     ON CONFLICT (code) DO NOTHING`
  );
}

export async function createTenant(name = 'Test Tenant'): Promise<{ id: string; name: string }> {
  const { rows } = await pool.query(`INSERT INTO tenants (name) VALUES ($1) RETURNING id, name`, [name]);
  return { id: rows[0].id, name: rows[0].name };
}

export async function createProTenant(name = 'Pro Tenant'): Promise<{ id: string }> {
  const t = await createTenant(name);
  const pricePro = process.env.STRIPE_PRICE_PRO ?? 'price_1UAOfnRMZHQ0shBochirtXWT';
  await pool.query(
    `INSERT INTO subscriptions (tenant_id, stripe_subscription_id, stripe_customer_id, stripe_price_id, plan_code, status, current_period_start, current_period_end)
     VALUES ($1,$2,$3,$4,'pro','active', date_trunc('month', now()), date_trunc('month', now()) + interval '1 month')`,
    [t.id, `sub_${t.id}`, `cus_${t.id}`, pricePro]
  );
  return t;
}

export async function countEvents(tenantId: string): Promise<number> {
  const { rows } = await pool.query(`SELECT COUNT(*)::int as c FROM usage_events WHERE tenant_id=$1`, [tenantId]);
  return rows[0].c;
}
