import { pool } from '../db/pool.js';
import { calculateTokenCost } from '../config/pricing.js';

function periodBounds(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const toDate = (d: Date) => d.toISOString().slice(0, 10);
  return { start: toDate(start), end: toDate(end) };
}

export const BillingService = {
  async rollup(tenantId: string) {
    const { start, end } = periodBounds();
    // plan resolution
    let plan: 'free' | 'pro' = 'free';
    let apiLimit = 1000;
    let tokenLimit = 100000;
    const { rows: subRows } = await pool.query(
      `SELECT plan_code FROM subscriptions WHERE tenant_id=$1 AND status='active' LIMIT 1`,
      [tenantId]
    );
    if (subRows.length > 0) plan = subRows[0].plan_code;
    const { rows: planRows } = await pool.query(`SELECT api_quota, token_quota FROM plans WHERE code=$1`, [plan]);
    if (planRows.length > 0) {
      apiLimit = planRows[0].api_quota;
      tokenLimit = planRows[0].token_quota;
    }

    const { rows } = await pool.query(
      `SELECT type, quantity, input_tokens, cached_input_tokens, output_tokens, reasoning_tokens FROM usage_events WHERE tenant_id=$1 AND billing_period_start=$2::date`,
      [tenantId, start]
    );

    let apiUsed = 0;
    let tokenUsed = 0;
    let input = 0,
      cachedInput = 0,
      output = 0,
      reasoning = 0;
    for (const r of rows) {
      if (r.type === 'api_call') apiUsed += Number(r.quantity);
      if (r.type === 'ai_tokens') {
        tokenUsed += Number(r.quantity);
        input += Number(r.input_tokens);
        cachedInput += Number(r.cached_input_tokens);
        output += Number(r.output_tokens);
        reasoning += Number(r.reasoning_tokens);
      }
    }

    const cost = calculateTokenCost({ input, cachedInput, output, reasoning });

    return {
      periodStart: start,
      periodEnd: end,
      plan,
      usage: {
        apiCalls: { used: apiUsed, limit: apiLimit },
        aiTokens: { used: tokenUsed, limit: tokenLimit, breakdown: { input, cachedInput, output, reasoning } },
      },
      cost,
      totalCents: cost.totalCents,
    };
  },
};
