import { hashRequest } from '../utils/hash.js';
import { AppError } from '../utils/errors.js';
import { usageRepo } from '../repos/usageRepo.js';
import { QuotaService } from './QuotaService.js';
import { PricingService } from './PricingService.js';

export type MeterParams = {
  tenantId: string;
  type: 'api_call' | 'ai_tokens';
  quantity?: number; // for api_call
  tokens?: { input: number; cachedInput: number; output: number; reasoning: number };
  key: string;
  // raw body for hash if needed
  rawBody?: unknown;
};

export const MeterService = {
  async record(params: MeterParams) {
    const { tenantId, type, key } = params;

    // normalize quantity: api_call uses quantity, ai_tokens uses sum of tokens
    let quantity: number;
    let inputTokens = 0,
      cachedInputTokens = 0,
      outputTokens = 0,
      reasoningTokens = 0;
    if (type === 'api_call') {
      quantity = params.quantity ?? 1;
    } else {
      const t = params.tokens ?? { input: 0, cachedInput: 0, output: 0, reasoning: 0 };
      inputTokens = t.input ?? 0;
      cachedInputTokens = t.cachedInput ?? 0;
      outputTokens = t.output ?? 0;
      reasoningTokens = t.reasoning ?? 0;
      quantity = inputTokens + cachedInputTokens + outputTokens + reasoningTokens;
      if (quantity === 0) quantity = 0; // allow 0? but validation should ensure >0
    }

    // compute request hash for key-reuse mismatch detection
    const requestHash = hashRequest({ tenantId, type, quantity, inputTokens, cachedInputTokens, outputTokens, reasoningTokens });

    // Fast-path: check existing key
    const existing = await usageRepo.findByTenantAndKey(tenantId, key);
    if (existing) {
      if (existing.request_hash !== requestHash) {
        throw new AppError(422, 'Idempotency key already used with different request', {
          code: 'idempotency_key_reused',
          details: { expectedHash: existing.request_hash, gotHash: requestHash },
        });
      }
      // byte-identical replay: return stored response without quota re-check per ADR
      const body = typeof existing.response_body === 'string' ? JSON.parse(existing.response_body) : existing.response_body;
      return { replayed: true, eventId: existing.id, used: body?.used, limit: body?.limit, cost: body?.cost, status: existing.response_status, body };
    }

    // Quota gate before insert
    const quota = await QuotaService.check(tenantId, type, quantity);
    if (!quota.allowed) {
      const rejected = quota.rejected!;
      if (rejected.code === 'quota_exceeded') {
        throw new AppError(429, rejected.message, {
          code: 'quota_exceeded',
          details: { used: rejected.used, limit: rejected.limit, periodEnd: rejected.periodEnd, retryAfter: rejected.retryAfter },
        });
      } else {
        throw new AppError(402, rejected.message, {
          code: 'payment_required',
          details: { used: rejected.used, limit: rejected.limit, upgradeUrl: rejected.upgradeUrl },
        });
      }
    }

    // Pricing (integer micro-cents) — also snapshot for replay
    const cost = PricingService.calculate({ input: inputTokens, cachedInput: cachedInputTokens, output: outputTokens, reasoning: reasoningTokens });

    // Prepare response snapshot to store for replay
    const responseBody = {
      id: null as string | null, // will be filled after insert
      used: quota.used + quantity,
      limit: quota.limit,
      cost,
      plan: quota.plan,
      periodStart: quota.periodStart,
      periodEnd: quota.periodEnd,
    };

    // Atomic insert with ON CONFLICT handling
    const inserted = await usageRepo.insertUsageEvent({
      tenantId,
      type,
      quantity,
      inputTokens,
      cachedInputTokens,
      outputTokens,
      reasoningTokens,
      idempotencyKey: key,
      requestHash,
      responseStatus: 200,
      responseBody,
    });

    if (inserted) {
      responseBody.id = inserted.id;
      // update stored body with id for future replay accuracy (second update)
      // we could leave as is, but ensure replay returns id
      // For simplicity, not updating again; replay will read stored body without id? Instead we store with id now via extra update?
      // Let's update the row's response_body to include id
      // (non-critical for core, but helps replay identity)
      // Do fire-and-forget update
      try {
        const { pool } = await import('../db/pool.js');
        await pool.query(`UPDATE usage_events SET response_body=$1 WHERE id=$2`, [JSON.stringify(responseBody), inserted.id]);
      } catch {}
      return { replayed: false, eventId: inserted.id, used: responseBody.used, limit: responseBody.limit, cost, status: 200, body: responseBody };
    } else {
      // concurrent insert won
      const winner = await usageRepo.findByTenantAndKey(tenantId, key);
      if (!winner) throw new AppError(500, 'Idempotency race: winner not found');
      if (winner.request_hash !== requestHash) {
        throw new AppError(422, 'Idempotency key already used with different request', {
          code: 'idempotency_key_reused',
          details: { expectedHash: winner.request_hash, gotHash: requestHash },
        });
      }
      const body = typeof winner.response_body === 'string' ? JSON.parse(winner.response_body) : winner.response_body;
      return { replayed: true, eventId: winner.id, used: body?.used, limit: body?.limit, cost: body?.cost, status: winner.response_status, body };
    }
  },
};
