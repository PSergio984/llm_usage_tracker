import { pool } from './pool.js';

async function seed() {
  console.log('[seed] ensuring demo tenants ...');
  // Two demo tenants: one Free, one Pro (via subscription). Tenant isolation proof creates both.
  const tenants = [
    { name: 'Acme — Free tenant', plan: 'free' as const },
    { name: 'Globex — Pro tenant', plan: 'pro' as const },
  ];

  for (const t of tenants) {
    const { rows } = await pool.query(
      `INSERT INTO tenants (name) VALUES ($1) RETURNING id, name`,
      [t.name]
    );
    const tenant = rows[0];
    console.log(`[seed] tenant ${tenant.name} → ${tenant.id}`);

    // Create an active subscription row mirroring Stripe shape (local stub, not calling Stripe)
    // For Pro tenant, create active subscription with pro price; for Free, no subscription (free is default) or free plan subscription
    if (t.plan === 'pro') {
      // Use price IDs from docs/STRIPE.md if present, else placeholder
      const pricePro = process.env.STRIPE_PRICE_PRO ?? 'price_1UAOfnRMZHQ0shBochirtXWT';
      await pool.query(
        `INSERT INTO subscriptions (tenant_id, stripe_subscription_id, stripe_customer_id, stripe_price_id, plan_code, status, current_period_start, current_period_end)
         VALUES ($1, $2, $3, $4, 'pro', 'active', date_trunc('month', now()), date_trunc('month', now()) + interval '1 month')
         ON CONFLICT (stripe_subscription_id) DO NOTHING`,
        [tenant.id, `sub_seed_${tenant.id}`, `cus_seed_${tenant.id}`, pricePro]
      );
      console.log(`[seed]   → subscription pro active`);
    } else {
      // Free tenant has no active subscription — plan resolved as free via fallback in QuotaService
      console.log(`[seed]   → no subscription (free fallback)`);
    }
  }

  // Prove isolation: tenants must not see each other's usage later — seed prints counts
  const { rows: counts } = await pool.query(`SELECT
    (SELECT COUNT(*) FROM tenants) as tenants,
    (SELECT COUNT(*) FROM plans) as plans,
    (SELECT COUNT(*) FROM subscriptions) as subscriptions,
    (SELECT COUNT(*) FROM usage_events) as usage_events`);
  console.log('[seed] counts', counts[0]);

  await pool.end();
  console.log('[seed] done');
}

seed().catch((err) => {
  console.error('[seed] failed', err);
  process.exit(1);
});
