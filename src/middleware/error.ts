import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors.js';
import { ZodError } from 'zod';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'validation_error', message: err.errors[0]?.message ?? 'Invalid input', details: err.errors });
  }
  if (err instanceof AppError) {
    const body: any = { error: err.code ?? 'error', message: err.message };
    if (err.details !== undefined) body.details = err.details;
    return res.status(err.status).json(body);
  }
  console.error('[unhandled]', err);
  return res.status(500).json({ error: 'internal_error', message: 'Internal server error' });
}
