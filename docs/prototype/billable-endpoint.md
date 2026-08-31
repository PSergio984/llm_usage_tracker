# Prototype — Billable endpoint & layered scaffolding

**Ticket:** [Prototype — Billable endpoint & layered scaffolding](https://github.com/PSergio984/llm_usage_tracker/issues/9) · `wayfinder:prototype` · HITL  
**Branch:** `prototype/billable-endpoint-scaffold`  
**Purpose:** Raise fidelity of "how should POST /generate behave and how does layered scaffolding look" — cheap, rough, concrete artifact to react to (not shipped code). Links stub files below.

## What this prototype is (and is not)

- **Is:** A throwaway stub that shows the layer cut (HTTP → service → repo), validation at boundary, idempotency replay, quota gate, and rollup read path in one glance. Code is outlined with `// TODO` and types, runnable shape but no DB wiring yet.
- **Is not:** Production-ready handlers, migrations, or Stripe integration (those live in #10 and #11). Don't harden this — react, then graduate to real src/.

## Layer sketch (ASCII)

```
Client
  │
  ├─POST /generate  ──►  routes/generate.ts  (validate + tenant + idempotency)
  │                          │ 402/429 vs 200 honest codes
  │                          ▼
  │                    services/MeterService.ts  (QuotaService.check → repos/usageRepo.insert)
  │                          │
  │                          ▼
  │                    repos/usageRepo.ts  (pg pool, INSERT ON CONFLICT + SELECT replay)
  │                          │
  │                          ▼
  │                    PostgreSQL (tenants, plans, usage_events, webhook_events)
  │
  └─GET /usage   ──►  routes/usage.ts  → services/BillingService.rollup() → usageRepo.rollup()
  └─GET /health  ──►  routes/health.ts

Cross-cutting: middleware/tenant.ts (X-Tenant-Id), middleware/idempotency.ts (header required),
               middleware/validate.ts (zod 400), middleware/error.ts, middleware/rawBody.ts (webhook only)
Background: jobs/alerts.ts (5-min scan 80/100%), jobs/reconciliation.ts (nightly)
Config: src/config/pricing.ts (already pinned) + env.ts (zod)
```

## Files in this prototype branch

Stubs are intentionally thin — read them in order:

| File | What to react to |
|------|------------------|
| `src/app.stub.ts` | Express app shape, middleware order (rawBody for webhooks before json), error mapping |
| `src/routes/generate.stub.ts` | Handler outline: validate → quota → meter → 200/429/402 + Retry-After + Idempotency-Replayed header |
| `src/routes/usage.stub.ts` | Rollup read path outline |
| `src/routes/health.stub.ts` | Liveness |
| `src/services/MeterService.stub.ts` | `record()` orchestrates QuotaService + usageRepo with byte-identical replay |
| `src/services/QuotaService.stub.ts` | `check()` sums period usage + requested vs plan limit, chooses 429 vs 402 per ADR 0002 |
| `src/services/PricingService.stub.ts` | thin wrapper over `src/config/pricing.ts` `calculateTokenCost` |
| `src/repos/usageRepo.stub.ts` | pg pool outline, `insertUsageEvent` with `ON CONFLICT (tenant_id, idempotency_key) DO NOTHING` + select |
| `src/middleware/*.stub.ts` | tenant, idempotency, validate (zod), error |
| `docker-compose.stub.yml` | Postgres via Docker one-liner |
| `capstone.yaml.stub` | run/seed/test/base_url manifest skeleton |

## How to read this prototype

1. **Start with `app.stub.ts`** — does middleware order feel right? Is `express.raw` isolated to `/webhooks/stripe`?
2. **Then `generate.stub.ts` → `MeterService.stub.ts`** — does quota gate before meter? Does replay bypass insert?
3. **React to choices:** Should `X-Tenant-Id` be header vs JWT? Should missing `Idempotency-Key` be 400 (current) vs auto-generate? Should API-call cost stay 0 in core?
4. **Next step if approved:** Copy stubs to real `src/*.ts`, replace `// TODO` with pg queries, add migrations per `docs/DESIGN.md` + `docs/adr/0001`.

## Open questions this prototype surfaces

- **Validation:** Should `tokens.cachedInput` be capped by `tokens.input` (validate 400 if larger)?
- **Quota:** For `ai_tokens` type, do we roll up sum of all token counts or sum of computed cost? Current checks `ai_tokens used = sum(output+reasoning+input+cached)` but design says two types: `api_calls` (count) vs `ai_tokens` (tokens sum) — clarify token sum vs separate.
- **capstone.yaml:** What should `run:` be (`docker compose up + npm run dev` vs single `npm start`)? What `base_url` (`http://localhost:3000`)?
- **Background job:** Will `jobs/alerts.ts` be `node-cron` or `BullMQ`? Prototype leaves as stub to decide after #11.

## Links

- Design doc: `docs/DESIGN.md` (schema, quotas, idempotency strategy)
- Pricing: `src/config/pricing.ts` (already pinned)
- Stripe provisioning: `docs/STRIPE.md`
- ADRs: `docs/adr/0001`, `0002`, `0003`
