// Stub — GET /usage rollup read path
import type { Request, Response, NextFunction } from 'express';
// import { BillingService } from '../services/BillingService.stub.js';

export async function usageHandler(req: Request, res: Response, next: NextFunction) {
  try {
    // const tenantId = (req as any).tenantId ?? (req.query.tenantId as string);
    // if (!tenantId) return res.status(400).json({ error: 'missing_tenant_id' });
    // const rollup = await BillingService.rollup(tenantId);
    // return res.json({ period_start: rollup.periodStart, period_end: rollup.periodEnd, plan: rollup.plan, usage: rollup.usage, cost_cents: rollup.cost.totalCents, cost_breakdown: rollup.cost });
    res.json({ stub: 'usage rollup outline — date_trunc month + pricing.ts calculateTokenCost' });
  } catch (err) { next(err); }
}
