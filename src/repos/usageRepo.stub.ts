// Stub — usageRepo with pg pool and atomic idempotent insert
// import { pool } from '../db/pool.js';

// export const usageRepo = {
//   async findByTenantAndKey(tenantId: string, key: string) {
//     const { rows } = await pool.query(
//       `SELECT id, tenant_id, idempotency_key, request_hash, response_status, response_body, used_snapshot, limit_snapshot, cost_snapshot
//        FROM usage_events WHERE tenant_id=$1 AND idempotency_key=$2`, [tenantId, key]
//     );
//     return rows[0] ?? null;
//   },
//   async sumPeriod(tenantId: string, type: string, periodStart: string) {
//     const { rows } = await pool.query(
//       `SELECT COALESCE(SUM(quantity),0) as sum FROM usage_events
//        WHERE tenant_id=$1 AND type=$2 AND billing_period_start=$3::date`, [tenantId, type, periodStart]
//     );
//     return Number(rows[0].sum);
//   },
//   async insertUsageEvent(params: any) {
//     // INSERT with unique violation handling — caller catches 23505
//     // Includes tenant_id, type, quantity, input_tokens etc., idempotency_key, request_hash, response_status/body
//     const { rows } = await pool.query(
//       `INSERT INTO usage_events (tenant_id, type, quantity, input_tokens, cached_input_tokens, output_tokens, reasoning_tokens, idempotency_key, request_hash, response_status, response_body, billing_period_start)
//        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, date_trunc('month', now())::date)
//        ON CONFLICT (tenant_id, idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
//        RETURNING id`, values
//     );
//     if (rows.length === 0) { const err: any = new Error('unique violation'); err.code = '23505'; throw err; }
//     return rows[0];
//   },
// };

export const usageRepo = { stub: 'See comment block for SQL shapes — partial unique index ux_usage_tenant_key' } as any;
