// Stub — POST /generate handler outline (billable metering)
// Spec: Idempotency-Key required per tenant, validate at boundary → 400, quota gate → 429/402, replay → 200 byte-identical
import type { Request, Response, NextFunction } from 'express';
// import { MeterService } from '../services/MeterService.stub.js';
// import { z } from 'zod';

const GenerateBody = /* z.object */ {
  // type: z.enum(['api_call', 'ai_tokens']),
  // quantity: z.number().int().positive().optional(), // for api_call
  // tokens: z.object({ input: z.number().int().min(0), cached_input: z.number().int().min(0), output: z.number().int().min(0), reasoning: z.number().int().min(0) }).optional(),
} as any;

export async function generateHandler(req: Request, res: Response, next: NextFunction) {
  try {
    // 1. Boundary validation (zod) → 400 if bad shape, never 500
    // const parsed = GenerateBody.parse(req.body);

    // 2. Tenant from middleware: req.tenantId (validated X-Tenant-Id header, 400 if missing)
    // const tenantId = (req as any).tenantId;

    // 3. Idempotency-Key required → 400 if missing/empty (per ADR 0001)
    // const key = req.headers['idempotency-key'] as string | undefined;
    // if (!key) return res.status(400).json({ error: 'missing_idempotency_key', message: 'Idempotency-Key header required' });

    // 4. Delegate to service — service handles quota + dedup + pricing
    // const result = await MeterService.record({
    //   tenantId,
    //   type: parsed.type,
    //   quantity: parsed.quantity ?? 1,
    //   tokens: parsed.tokens,
    //   key,
    //   requestHash: hashRequest(parsed), // sha256 of canonical JSON for key-reuse mismatch check
    // });

    // 5. Map service result to honest codes (per ADR 0002)
    // if (result.replayed) res.setHeader('X-Idempotency-Replayed', 'true');
    // if (result.rejected?.code === 'quota_exceeded') {
    //   res.setHeader('Retry-After', String(result.rejected.retryAfter));
    //   return res.status(429).json({ error: 'quota_exceeded', used: result.rejected.used, limit: result.rejected.limit, period_end: result.rejected.periodEnd, message: result.rejected.message });
    // }
    // if (result.rejected?.code === 'payment_required') {
    //   return res.status(402).json({ error: 'payment_required', used: result.rejected.used, limit: result.rejected.limit, upgrade_url: result.rejected.upgradeUrl, message: result.rejected.message });
    // }
    // return res.status(200).json({ id: result.eventId, replayed: !!result.replayed, used: result.used, limit: result.limit, cost: result.cost });
    res.status(200).json({ stub: 'generate handler outline — see comments above' });
  } catch (err) { next(err); }
}
