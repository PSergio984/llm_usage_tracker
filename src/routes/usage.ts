import type { Response, NextFunction } from 'express';
import type { TenantRequest } from '../middleware/tenant.js';
import { BillingService } from '../services/BillingService.js';

export async function usageHandler(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = req.tenantId!;
    const rollup = await BillingService.rollup(tenantId);
    res.json(rollup);
  } catch (err) {
    next(err);
  }
}
