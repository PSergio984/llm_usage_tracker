// Stub — QuotaService.check enforces hard-reject boundary
// import { usageRepo } from '../repos/usageRepo.stub.js';
// import { subscriptionRepo } from '../repos/subscriptionRepo.stub.js';
// import { plans } from '../config/plans.js'; // or DB plans table

export const QuotaService = {
  async check(tenantId: string, type: 'api_call' | 'ai_tokens', requested: number) {
    // // 1. Resolve tenant's active subscription + plan limits (tenants → subscriptions → plans)
    // const sub = await subscriptionRepo.findActive(tenantId);
    // const plan = sub ? { code: sub.plan_code, limits: { api_calls: ..., ai_tokens: ... } } : { code: 'free', limits: { api_calls: 1000, ai_tokens: 100000 } };
    // // 2. Period sum
    // const used = await usageRepo.sumPeriod(tenantId, type, periodStart); // WHERE billing_period_start = date_trunc
    // // 3. Boundary: allowed if used + requested <= limit (exactly at limit allowed, next over rejected)
    // const limit = type === 'api_call' ? plan.limits.api_calls : plan.limits.ai_tokens;
    // if (used + requested > limit) {
    //   const isPaidAndActive = sub?.status === 'active' && plan.code === 'pro';
    //   const isFreeOver = plan.code === 'free';
    //   if (isPaidAndActive) {
    //     // 429 — wait until next period
    //     const retryAfter = secondsUntil(periodEnd);
    //     return { allowed: false, rejected: { code: 'quota_exceeded', used, limit, periodEnd, retryAfter, message: `Quota exceeded: ${used}/${limit} ${type} for this period. Resets at ${periodEnd}` } };
    //   } else {
    //     // 402 — needs upgrade/payment
    //     return { allowed: false, rejected: { code: 'payment_required', used, limit, upgradeUrl: `/checkout?plan=pro&tenantId=${tenantId}`, message: `Free plan limit ${limit} ${type} exceeded. Upgrade to Pro for 10k/month.` } };
    //   }
    // }
    // return { allowed: true, used, limit, newUsed: used + requested };
    return { stub: 'QuotaService.check outline — see DSL above', tenantId, type, requested } as any;
  },
};
