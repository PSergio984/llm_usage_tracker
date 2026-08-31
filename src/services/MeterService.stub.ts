// Stub — MeterService.record orchestrates quota, dedup, pricing
// import { QuotaService } from './QuotaService.stub.js';
// import { usageRepo } from '../repos/usageRepo.stub.js';
// import { PricingService } from './PricingService.stub.js';
// import { hash } from '../utils/hash.js';

export type RecordParams = {
  tenantId: string;
  type: 'api_call' | 'ai_tokens';
  quantity?: number;
  tokens?: { input: number; cachedInput: number; output: number; reasoning: number };
  key: string;
  requestHash: string;
};

export const MeterService = {
  async record(params: RecordParams) {
    // 1. Compute requested quantity: api_call quantity or sum tokens
    // const requested = params.type === 'api_call' ? (params.quantity ?? 1) : totalTokens(params.tokens);

    // 2. Fast-path: check if same tenant+key already exists — if yes, compare requestHash
    // const existing = await usageRepo.findByTenantAndKey(params.tenantId, params.key);
    // if (existing) {
    //   if (existing.request_hash !== params.requestHash) {
    //     // key reused with different payload → 422 per ADR 0001
    //     throw { status: 422, code: 'idempotency_key_reused' };
    //   }
    //   // byte-identical replay — return stored response without quota re-check
    //   return { replayed: true, eventId: existing.id, used: existing.used_snapshot, limit: existing.limit_snapshot, cost: existing.cost_snapshot };
    // }

    // 3. Quota gate — must happen before insert (per ADR 0002)
    // const quota = await QuotaService.check(params.tenantId, params.type, requested);
    // if (!quota.allowed) {
    //   // quota.rejected contains {code: 'quota_exceeded' | 'payment_required', used, limit, retryAfter/upgradeUrl}
    //   return { rejected: quota.rejected };
    // }

    // 4. Pricing — integer micro-cents via pricing.ts
    // const cost = PricingService.calculate(params.tokens);

    // 5. Insert with atomic conflict handling (race-safe)
    // try {
    //   const inserted = await usageRepo.insertUsageEvent({ ...params, cost });
    //   return { replayed: false, eventId: inserted.id, used: quota.newUsed, limit: quota.limit, cost };
    // } catch (e: any) {
    //   if (e.code === '23505' /* unique_violation */) {
    //     // concurrent insert won — fetch winner and replay
    //     const winner = await usageRepo.findByTenantAndKey(params.tenantId, params.key);
    //     return { replayed: true, eventId: winner.id, used: winner.used_snapshot, limit: winner.limit_snapshot, cost: winner.cost_snapshot };
    //   }
    //   throw e;
    // }
    return { stub: 'MeterService.record outline — see comments' } as any;
  },
};
