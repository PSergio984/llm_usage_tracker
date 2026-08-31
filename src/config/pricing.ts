/**
 * Pricing constants pinned for Probe 5 — integer micro-cents per 1k tokens.
 * Store money as integers (cents / micro-units), never floats.
 * Per docs/DESIGN.md § Pricing (Q5 Gemini-like).
 *
 * Rates:
 * - INPUT: 150 micro-cents / 1k  => $0.0015 / 1k (0.15¢)
 * - CACHED: 75 micro-cents / 1k  => $0.00075 / 1k (0.075¢) = ½ INPUT
 * - OUTPUT: 200 micro-cents / 1k => $0.002 / 1k (0.20¢)
 * - Reasoning tokens billed as OUTPUT (not separate free category)
 *
 * Cost math uses integers only; no floating point at any step.
 * Categories are NOT simply added together — each billed at its own rate.
 * Billing period is calendar month UTC (date_trunc('month', created_at)).
 */

export const PRICING = {
  /** cost per 1k INPUT tokens in micro-cents (1 cent = 1000 micro-cents) */
  INPUT_PER_1K_MICROCENTS: 150,
  /** cached input is cheaper: exactly ½ of INPUT */
  CACHED_PER_1K_MICROCENTS: 75,
  /** cost per 1k OUTPUT tokens (and any REASONING tokens billed as output) */
  OUTPUT_PER_1K_MICROCENTS: 200,

  /** API call cost in core: 0 (metered but free); overage stretch adds price */
  API_CALL_MICROCENTS: 0,

  /** currency scaling: 1 cent = 1000 micro-cents */
  MICROCENTS_PER_CENT: 1000,
  /** 1 dollar = 100 cents = 100_000 micro-cents */
  MICROCENTS_PER_DOLLAR: 100_000,
} as const;

export type TokenUsage = {
  input: number;          // ≥0 integer
  cachedInput: number;    // ≥0 integer, ≤ input logically but not enforced here
  output: number;         // ≥0 integer
  reasoning: number;      // ≥0 integer, billed as output
};

export type CostBreakdown = {
  inputMicrocents: number;
  cachedMicrocents: number;
  outputMicrocents: number;
  reasoningMicrocents: number; // included in outputMicrocents conceptually, kept separate for audit
  totalMicrocents: number;
  totalCents: number;          // rounded up cents (ceil)
};

/**
 * Integer-only cost for a batch of tokens.
 * Each category ceiling-divides by 1000 to charge per started 1k block,
 * matching typical provider billing (no float, no rounding ambiguity).
 */
export function calculateTokenCost(tokens: TokenUsage): CostBreakdown {
  const inputBlocks = ceilDiv(tokens.input, 1000);
  const cachedBlocks = ceilDiv(tokens.cachedInput, 1000);
  const outputBlocks = ceilDiv(tokens.output, 1000);
  const reasoningBlocks = ceilDiv(tokens.reasoning, 1000);

  const inputMicrocents = inputBlocks * PRICING.INPUT_PER_1K_MICROCENTS;
  const cachedMicrocents = cachedBlocks * PRICING.CACHED_PER_1K_MICROCENTS;
  // reasoning billed as output
  const outputMicrocents = outputBlocks * PRICING.OUTPUT_PER_1K_MICROCENTS;
  const reasoningMicrocents = reasoningBlocks * PRICING.OUTPUT_PER_1K_MICROCENTS;

  const totalMicrocents =
    inputMicrocents + cachedMicrocents + outputMicrocents + reasoningMicrocents;
  const totalCents = ceilDiv(totalMicrocents, PRICING.MICROCENTS_PER_CENT);

  return {
    inputMicrocents,
    cachedMicrocents,
    outputMicrocents,
    reasoningMicrocents,
    totalMicrocents,
    totalCents,
  };
}

/**
 * Rollup helpers — GET /usage shape per docs/DESIGN.md
 * Rollup aggregates usage_events per tenant+period; cost derived via calculateTokenCost.
 */
export type UsageRollup = {
  periodStart: string; // ISO date_trunc month
  periodEnd: string;
  plan: 'free' | 'pro';
  usage: {
    apiCalls: { used: number; limit: number };
    aiTokens: { used: number; limit: number; breakdown?: TokenUsage };
  };
  cost: CostBreakdown;
};

function ceilDiv(a: number, b: number): number {
  return Math.floor((a + b - 1) / b);
}

// Example transcript shape for EVIDENCE.md (Probe 5):
// Input 1,500 + Cached 500 + Output 2,500 + Reasoning 1,000
// → inputBlocks=2 (150*2=300), cachedBlocks=1 (75*1=75), outputBlocks=3 (200*3=600), reasoningBlocks=1 (200*1=200)
// → totalMicrocents=300+75+600+200=1175 → totalCents=2 (ceil 1175/1000)
// Float trap if anyone used dollars as float: 0.0015*1.5 + 0.00075*0.5 + 0.002*2.5 + 0.002*1.0 = 0.008025 → 0.008024999999… floating error
