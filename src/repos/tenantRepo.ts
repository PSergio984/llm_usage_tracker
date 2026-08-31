import { pool } from '../db/pool.js';

export type Tenant = { id: string; name: string; stripeCustomerId: string | null; createdAt: string };

export const tenantRepo = {
  async create(name: string): Promise<Tenant> {
    const { rows } = await pool.query(
      `INSERT INTO tenants (name) VALUES ($1) RETURNING id, name, stripe_customer_id, created_at`,
      [name]
    );
    return { id: rows[0].id, name: rows[0].name, stripeCustomerId: rows[0].stripe_customer_id, createdAt: rows[0].created_at };
  },
  async findById(id: string): Promise<Tenant | null> {
    const { rows } = await pool.query(`SELECT id, name, stripe_customer_id, created_at FROM tenants WHERE id=$1`, [id]);
    if (rows.length === 0) return null;
    return { id: rows[0].id, name: rows[0].name, stripeCustomerId: rows[0].stripe_customer_id, createdAt: rows[0].created_at };
  },
  async setStripeCustomerId(id: string, stripeCustomerId: string) {
    await pool.query(`UPDATE tenants SET stripe_customer_id=$2 WHERE id=$1`, [id, stripeCustomerId]);
  },
  async list(): Promise<Tenant[]> {
    const { rows } = await pool.query(`SELECT id, name, stripe_customer_id, created_at FROM tenants ORDER BY created_at`);
    return rows.map((r: any) => ({ id: r.id, name: r.name, stripeCustomerId: r.stripe_customer_id, createdAt: r.created_at }));
  },
};
