// Stub — subscriptionRepo upsert mirrored from Stripe
// import { pool } from '../db/pool.js';

// export const subscriptionRepo = {
//   async upsertFromStripe(params: { tenantId: string; stripeSubscriptionId: string; stripeCustomerId: string; priceId: string; planCode: 'free'|'pro'; status: string; periodStart: Date; periodEnd: Date }) {
//     await pool.query(
//       `INSERT INTO subscriptions (tenant_id, stripe_subscription_id, stripe_customer_id, stripe_price_id, plan_code, status, current_period_start, current_period_end)
//        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
//        ON CONFLICT (stripe_subscription_id) DO UPDATE SET plan_code=EXCLUDED.plan_code, status=EXCLUDED.status, current_period_start=EXCLUDED.current_period_start, current_period_end=EXCLUDED.current_period_end, updated_at=now()`,
//       [params.tenantId, params.stripeSubscriptionId, params.stripeCustomerId, params.priceId, params.planCode, params.status, params.periodStart, params.periodEnd]
//     );
//   },
//   async findActive(tenantId: string) {
//     const { rows } = await pool.query(
//       `SELECT * FROM subscriptions WHERE tenant_id=$1 AND status='active' ORDER BY current_period_end DESC LIMIT 1`, [tenantId]
//     );
//     return rows[0] ?? null;
//   },
// };

export const subscriptionRepo = { stub: 'See comment block — upsert on stripe_subscription_id, findActive per tenant' } as any;
