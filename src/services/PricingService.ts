import { PRICING, calculateTokenCost as calc, TokenUsage } from '../config/pricing.js';

export const PricingService = {
  calculate(tokens: TokenUsage) {
    return calc(tokens);
  },
  // helper for api_call type (no tokens)
  apiCallCost(): number {
    return 0;
  },
  // expose constants for tests/EVIDENCE
  PRICING,
};
