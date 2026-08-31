import type { Response, NextFunction } from 'express';
import { z } from 'zod';
import type { TenantRequest } from '../middleware/tenant.js';
import { MeterService } from '../services/MeterService.js';
import { AppError } from '../utils/errors.js';

const GenerateSchema = z
  .object({
    type: z.enum(['api_call', 'ai_tokens']),
    quantity: z.number().int().positive().optional(),
    tokens: z
      .object({
        input: z.number().int().min(0).optional(),
        cached_input: z.number().int().min(0).optional(),
        cachedInput: z.number().int().min(0).optional(),
        output: z.number().int().min(0).optional(),
        reasoning: z.number().int().min(0).optional(),
      })
      .optional(),
  })
  .refine(
    (d) => {
      if (d.type === 'api_call') return typeof d.quantity === 'number' && d.quantity > 0;
      if (d.type === 'ai_tokens') return !!d.tokens;
      return false;
    },
    { message: 'For api_call provide quantity; for ai_tokens provide tokens' }
  );

export async function generateHandler(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const parsed = GenerateSchema.safeParse(req.body);
    if (!parsed.success) throw parsed.error;

    const tenantId = req.tenantId!;
    const key = (req as any).idempotencyKey as string;
    if (!key) throw new AppError(400, 'Missing Idempotency-Key', { code: 'missing_idempotency_key' });

    const data = parsed.data;
    let tokens: { input: number; cachedInput: number; output: number; reasoning: number } | undefined;
    if (data.type === 'ai_tokens' && data.tokens) {
      const t: any = data.tokens;
      tokens = {
        input: t.input ?? 0,
        cachedInput: t.cached_input ?? t.cachedInput ?? 0,
        output: t.output ?? 0,
        reasoning: t.reasoning ?? 0,
      };
      if (tokens.cachedInput > tokens.input) {
        throw new AppError(400, 'cached_input cannot exceed input', { code: 'invalid_tokens' });
      }
    }

    const result = await MeterService.record({
      tenantId,
      type: data.type,
      quantity: data.quantity,
      tokens,
      key,
      rawBody: req.body,
    });

    if ((result as any).replayed) res.setHeader('X-Idempotency-Replayed', 'true');
    return res.status(200).json(result.body ?? result);
  } catch (err: any) {
    if (err instanceof AppError && err.status === 429) {
      const retry = (err.details as any)?.retryAfter ?? (err.details as any)?.retry_after;
      if (retry) (err as any).retryAfterHeader = String(retry);
      // also set header here if we have details
    }
    return next(err);
  }
}
