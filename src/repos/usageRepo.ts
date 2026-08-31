import { pool } from '../db/pool.js';

export type UsageEvent = {
  id: string;
  tenantId: string;
  type: 'api_call' | 'ai_tokens';
  quantity: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  idempotencyKey: string;
  requestHash: string | null;
  responseStatus: number | null;
  responseBody: any | null;
  createdAt: string;
  billingPeriodStart: string;
};

// sums per period for quota check
export const usageRepo = {
  async sumPeriod(tenantId: string, type: 'api_call' | 'ai_tokens', periodStart: string): Promise<number> {
    const { rows } = await pool.query(
      `SELECT COALESCE(SUM(quantity),0)::int as sum FROM usage_events WHERE tenant_id=$1 AND type=$2 AND billing_period_start=$3::date`,
      [tenantId, type, periodStart]
    );
    return Number(rows[0].sum);
  },
  async sumTokensPeriod(tenantId: string, periodStart: string): Promise<number> {
    // total tokens approximated as quantity already? For ai_tokens quantity = total tokens
    const { rows } = await pool.query(
      `SELECT COALESCE(SUM(quantity),0)::int as sum FROM usage_events WHERE tenant_id=$1 AND type='ai_tokens' AND billing_period_start=$3::date`,
      [tenantId, periodStart]
    );
    return Number(rows[0].sum);
  },
  async findByTenantAndKey(tenantId: string, key: string) {
    const { rows } = await pool.query(
      `SELECT id, tenant_id, idempotency_key, request_hash, response_status, response_body, quantity, type
       FROM usage_events WHERE tenant_id=$1 AND idempotency_key=$2`,
      [tenantId, key]
    );
    return rows[0] ?? null;
  },
  async insertUsageEvent(params: {
    tenantId: string;
    type: 'api_call' | 'ai_tokens';
    quantity: number;
    inputTokens: number;
    cachedInputTokens: number;
    outputTokens: number;
    reasoningTokens: number;
    idempotencyKey: string;
    requestHash: string;
    responseStatus: number;
    responseBody: any;
  }): Promise<{ id: string } | null> {
    try {
      const { rows } = await pool.query(
        `INSERT INTO usage_events (tenant_id, type, quantity, input_tokens, cached_input_tokens, output_tokens, reasoning_tokens, idempotency_key, request_hash, response_status, response_body, billing_period_start)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, date_trunc('month', now())::date)
         ON CONFLICT (tenant_id, idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
         RETURNING id`,
        [
          params.tenantId,
          params.type,
          params.quantity,
          params.inputTokens,
          params.cachedInputTokens,
          params.outputTokens,
          params.reasoningTokens,
          params.idempotencyKey,
          params.requestHash,
          params.responseStatus,
          JSON.stringify(params.responseBody),
        ]
      );
      if (rows.length === 0) return null;
      return { id: rows[0].id };
    } catch (e: any) {
      if (e.code === '23505') return null;
      throw e;
    }
  },
  async rollup(tenantId: string, periodStart: string) {
    const { rows } = await pool.query(
      `SELECT type, quantity, input_tokens, cached_input_tokens, output_tokens, reasoning_tokens FROM usage_events WHERE tenant_id=$1 AND billing_period_start=$2::date`,
      [tenantId, periodStart]
    );
    return rows;
  },
};
