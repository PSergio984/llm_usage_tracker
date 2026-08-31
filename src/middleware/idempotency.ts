import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors.js';

export function requireIdempotencyKey(req: Request, _res: Response, next: NextFunction) {
  const key = (req.headers['idempotency-key'] as string | undefined)?.trim() ??
    (req.headers['Idempotency-Key'] as string | undefined)?.trim();
  if (!key) {
    return next(new AppError(400, 'Missing Idempotency-Key header', { code: 'missing_idempotency_key' }));
  }
  if (key.length > 255) {
    return next(new AppError(400, 'Idempotency-Key too long', { code: 'invalid_idempotency_key' }));
  }
  (req as any).idempotencyKey = key;
  return next();
}
