import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors.js';
import { pool } from '../db/pool.js';

export interface TenantRequest extends Request {
  tenantId?: string;
  tenant?: { id: string; name: string; stripeCustomerId: string | null };
}

/**
 * Resolves X-Tenant-Id header (uuid) to tenant row. Validates at boundary → 400.
 * Also accepts query ?tenantId for GET /usage convenience (evaluator probes use tenantId param).
 */
export async function tenantMiddleware(req: TenantRequest, _res: Response, next: NextFunction) {
  const headerId = (req.headers['x-tenant-id'] as string | undefined)?.trim();
  const queryId = (req.query.tenantId as string | undefined)?.trim();
  const tenantId = headerId ?? queryId;
  if (!tenantId) {
    return next(new AppError(400, 'Missing tenant identifier: provide X-Tenant-Id header or tenantId query', { code: 'missing_tenant_id' }));
  }
  // uuid format check (8-4-4-4-12)
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(tenantId)) {
    return next(new AppError(400, 'Invalid tenant id format', { code: 'invalid_tenant_id' }));
  }
  try {
    const { rows } = await pool.query(`SELECT id, name, stripe_customer_id FROM tenants WHERE id=$1`, [tenantId]);
    if (rows.length === 0) {
      return next(new AppError(404, 'Tenant not found', { code: 'tenant_not_found' }));
    }
    req.tenantId = tenantId;
    req.tenant = { id: rows[0].id, name: rows[0].name, stripeCustomerId: rows[0].stripe_customer_id };
    return next();
  } catch (err) {
    return next(err);
  }
}
