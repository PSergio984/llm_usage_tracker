import { describe, it, expect } from 'vitest';
import { calculateTokenCost, PRICING } from '../src/config/pricing.js';

describe('Pricing — integer micro-cents, cached 1/2, reasoning as output', () => {
  it('cached cheaper is exactly half of input', () => {
    expect(PRICING.CACHED_PER_1K_MICROCENTS).toBe(PRICING.INPUT_PER_1K_MICROCENTS / 2);
  });

  it('reasoning billed as output', () => {
    const a = calculateTokenCost({ input: 0, cachedInput: 0, output: 1000, reasoning: 0 });
    const b = calculateTokenCost({ input: 0, cachedInput: 0, output: 0, reasoning: 1000 });
    expect(a.totalMicrocents).toBe(b.totalMicrocents);
    expect(a.totalMicrocents).toBe(PRICING.OUTPUT_PER_1K_MICROCENTS);
  });

  it('categories not simply added: each billed at own rate vs naive sum', () => {
    // input 1000 + cached 1000 + output 1000 = naive 3000 tokens * single rate would be wrong
    const cost = calculateTokenCost({ input: 1000, cachedInput: 1000, output: 1000, reasoning: 0 });
    // correct: 150 + 75 + 200 = 425 micro-cents (ceil per 1k)
    expect(cost.totalMicrocents).toBe(150 + 75 + 200);
    // naive single-rate (e.g., INPUT only) would be 3000/1000*150=450, not 425
    expect(cost.totalMicrocents).not.toBe(450);
  });

  it('example 1500/500/2500/1000 → 1175 micro-cents → 2 cents', () => {
    const c = calculateTokenCost({ input: 1500, cachedInput: 500, output: 2500, reasoning: 1000 });
    // input 1500 → 2 blocks *150=300, cached 500→1*75=75, output 2500→3*200=600, reasoning 1000→1*200=200
    expect(c.inputMicrocents).toBe(300);
    expect(c.cachedMicrocents).toBe(75);
    expect(c.outputMicrocents).toBe(600);
    expect(c.reasoningMicrocents).toBe(200);
    expect(c.totalMicrocents).toBe(1175);
    expect(c.totalCents).toBe(2); // ceil(1175/1000)
  });

  it('integer only: no float trap 0.1+0.2', () => {
    const floatTrap = 0.1 + 0.2;
    expect(floatTrap).not.toBe(0.3);
    const intCents = 10 + 20;
    expect(intCents).toBe(30);
    const cost = calculateTokenCost({ input: 100, cachedInput: 0, output: 0, reasoning: 0 });
    // 100 tokens → 1 block → 150 micro-cents, integer
    expect(Number.isInteger(cost.totalMicrocents)).toBe(true);
  });
});
