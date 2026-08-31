import { pool } from '../db/pool.js';

export type Subscription = {
  id: string;
  tenantId: string;
  stripeSubscriptionId: string;
  stripeCustomerId: string | null;
  stripePriceId: string | null;
  planCode: 'free' | 'pro';
  status: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
};

export const subscriptionRepo = {
  async findActive(tenantId: string): Promise<Subscription | null> {
    const { rows } = await pool.query(
      `SELECT id, tenant_id, stripe_subscription_id, stripe_customer_id, stripe_price_id, plan_code, status, current_period_start, current_period_end
       FROM subscriptions WHERE tenant_id=$1 AND status='active' ORDER BY current_period_end DESC LIMIT 1`,
      [tenantId]
    );
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      tenantId: r.tenant_id,
      stripeSubscriptionId: r.stripe_subscription_id,
      stripeCustomerId: r.stripe_customer_id,
      stripePriceId: r.stripe_price_id,
      planCode: r.plan_code,
      status: r.status,
      currentPeriodStart: r.current_period_start,
      currentPeriodEnd: r.current_period_end,
    };
  },
  async findByStripeId(stripeSubscriptionId: string): Promise<Subscription | null> {
    const { rows } = await pool.query(
      `SELECT id, tenant_id, stripe_subscription_id, stripe_customer_id, stripe_price_id, plan_code, status, current_period_start, current_period_end
       FROM subscriptions WHERE stripe_subscription_id=$1`,
      [stripeSubscriptionId]
    );
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      tenantId: r.tenant_id,
      stripeSubscriptionId: r.stripe_subscription_id,
      stripeCustomerId: r.stripe_customer_id,
      stripePriceId: r.stripe_price_id,
      planCode: r.plan_code,
      status: r.status,
      currentPeriodStart: r.current_period_start,
      currentPeriodEnd: r.current_period_end,
    };
  },
  async upsert(params: {
    tenantId: string;
    stripeSubscriptionId: string;
    stripeCustomerId: string | null;
    stripePriceId: string | null;
    planCode: 'free' | 'pro';
    status: string;
    currentPeriodStart?: string | null;
    currentPeriodEnd?: string | null;
  }) {
    await pool.query(
      `INSERT INTO subscriptions (tenant_id, stripe_subscription_id, stripe_customer_id, stripe_price_id, plan_code, status, current_period_start, current_period_end)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (stripe_subscription_id) DO UPDATE SET
         tenant_id=EXCLUDED.tenant_id,
         stripe_customer_id=EXCLUDED.stripe_customer_id,
         stripe_price_id=EXCLUDED.stripe_price_id,
         plan_code=EXCLUDED.plan_code,
         status=EXCLUDED.status,
         current_period_start=EXCLUDED.current_period_start,
         current_period_end=EXCLUDED.current_period_end,
         updated_at=now()`,
      [
        params.tenantId,
        params.stripeSubscriptionId,
        params.stripeCustomerId,
        params.stripePriceId,
        params.planCode,
        params.status,
        params.currentPeriodStart ?? null,
        params.currentPeriodEnd ?? null,
      ]
    );
  },
};
