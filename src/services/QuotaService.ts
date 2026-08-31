import { pool } from '../db/pool.js';
import { subscriptionRepo } from '../repos/subscriptionRepo.js';
import { usageRepo } from '../repos/usageRepo.js';

export type QuotaCheck = {
  allowed: boolean;
  used: number;
  limit: number;
  periodStart: string;
  periodEnd: string;
  retryAfter?: number;
  upgradeUrl?: string;
  plan: 'free' | 'pro';
  rejected?: { code: 'quota_exceeded' | 'payment_required'; used: number; limit: number; periodEnd?: string; retryAfter?: number; upgradeUrl?: string; message: string };
};

function periodBounds(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const toDate = (d: Date) => d.toISOString().slice(0, 10);
  return { start: toDate(start), end: toDate(end) };
}

function secondsUntil(dateStr: string): number {
  const end = new Date(dateStr + 'T00:00:00Z').getTime();
  const now = Date.now();
  return Math.max(0, Math.ceil((end - now) / 1000));
}

export const QuotaService = {
  async check(tenantId: string, type: 'api_call' | 'ai_tokens', requested: number): Promise<QuotaCheck> {
    const { start, end } = periodBounds();
    const sub = await subscriptionRepo.findActive(tenantId);
    let plan: 'free' | 'pro' = 'free';
    let limit: number;
    let status: string | null = null;
    if (sub) {
      plan = sub.planCode;
      status = sub.status;
      // fetch plan limits from DB plans table
      const { rows } = await pool.query(`SELECT api_quota, token_quota FROM plans WHERE code=$1`, [plan]);
      const p = rows[0];
      limit = type === 'api_call' ? p.api_quota : p.token_quota;
    } else {
      // free fallback
      const { rows } = await pool.query(`SELECT api_quota, token_quota FROM plans WHERE code='free'`);
      const p = rows[0];
      limit = type === 'api_call' ? p.api_quota : p.token_quota;
    }

    const used = await usageRepo.sumPeriod(tenantId, type, start);
    const would = used + requested;

    // hard-reject: exactly at limit allowed, next over rejected
    if (would <= limit) {
      return { allowed: true, used, limit, periodStart: start, periodEnd: end, plan };
    }

    // over limit: decide 429 vs 402
    // 402 when Free needs upgrade or subscription not active
    const needsUpgrade = plan === 'free' || status === 'past_due' || status === 'canceled' || status === 'incomplete' || status === 'unpaid';
    if (needsUpgrade) {
      const upgradeUrl = `/checkout?plan=pro&tenantId=${tenantId}`;
      return {
        allowed: false,
        used,
        limit,
        periodStart: start,
        periodEnd: end,
        plan,
        upgradeUrl,
        rejected: {
          code: 'payment_required',
          used,
          limit,
          upgradeUrl,
          message: `Free plan limit ${limit} ${type} exceeded (${used}/${limit}). Upgrade to Pro for 10k/month.`,
        },
      };
    } else {
      // Pro active over limit → 429 quota_exceeded with Retry-After
      const retryAfter = secondsUntil(end);
      return {
        allowed: false,
        used,
        limit,
        periodStart: start,
        periodEnd: end,
        plan,
        retryAfter,
        rejected: {
          code: 'quota_exceeded',
          used,
          limit,
          periodEnd: end,
          retryAfter,
          message: `Quota exceeded: ${used}/${limit} ${type} for this period. Resets at ${end}`,
        },
      };
    }
  },
};
