# Pricing pin: Gemini-like input/cached/output per 1k in integer micro-cents

Pinned pricing constants in `src/config/pricing.ts` as integers per 1k — `INPUT=150`, `CACHED=75` (½), `OUTPUT=200` micro-cents, reasoning billed as output; cost is `ceil(tokens/1000)*rate` summed per category with no naive addition across categories. Chosen over OpenAI-like quarter-caching and over float-dollar storage because brief §5 requires cached cheaper, reasoning=output, categories not simply added together and §12 probes check exact totals (Probe 5) plus money must be integer cents/micro-units — float storage would reintroduce `0.1+0.2≠0.3` traps evidenced in research; integer micro-cents keeps Probe 5 deterministic and EVIDENCE.md transcripts reproducible.

## Considered Options

- **OpenAI-like (cached = ¼ input):** different ratio, would still pass integer requirement but diverges from Gemini reference in brief resources (Gemini pricing doc) and from the ½ example chosen for clear EVIDENCE proof.
- **Float dollars:** fails Modern Treasury/Probe 5 — `0.0015*1.5` floating error vs `150*2` integer blocks.

## Consequences

- `GET /usage` rollup uses `calculateTokenCost` integer math; EVIDENCE.md will show breakdown per example (1500 input → 300 micro-cents etc.) and total `1175 micro-cents → 2 cents` (ceil).
- Billing period is `date_trunc('month', created_at)` composite index; API-call cost 0 in core (metered but free), overage stretch adds price there.
