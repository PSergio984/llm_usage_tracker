import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { tenantRepo } from '../repos/tenantRepo.js';
import { pool } from '../db/pool.js';

const CreateSchema = z.object({ name: z.string().min(1).max(100) });

export async function listTenantsHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    const tenants = await tenantRepo.list();
    // also include plan per tenant for convenience
    const { rows: subs } = await pool.query(
      `SELECT tenant_id, plan_code FROM subscriptions WHERE status='active'`
    );
    const planMap = new Map(subs.map((r: any) => [r.tenant_id, r.plan_code]));
    const withPlan = tenants.map((t) => ({
      id: t.id,
      name: t.name,
      stripeCustomerId: t.stripeCustomerId,
      plan: planMap.get(t.id) ?? 'free',
      createdAt: t.createdAt,
    }));
    res.json({ tenants: withPlan });
  } catch (e) {
    next(e);
  }
}

export async function createTenantHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = CreateSchema.safeParse(req.body);
    if (!parsed.success) throw parsed.error;
    const tenant = await tenantRepo.create(parsed.data.name);
    res.status(201).json({ id: tenant.id, name: tenant.name });
  } catch (e) {
    next(e);
  }
}
