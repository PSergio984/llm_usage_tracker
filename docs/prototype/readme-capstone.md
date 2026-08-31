# Prototype — README diagram + capstone.yaml manifest

**Ticket:** [Prototype — README diagram + capstone.yaml manifest](https://github.com/PSergio984/llm_usage_tracker/issues/19) · `wayfinder:prototype` · HITL  
**Branch:** `prototype/readme-capstone-yaml`  
**Purpose:** Raise fidelity of README system sketch and evaluator manifest — cheap ASCII artifact to react to.

## Prototype artifact (to react to)

### ASCII architecture diagram (proposed for README.md)

```
                Client (curl / test harness / Stripe CLI)
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
   POST /generate    GET /usage      POST /checkout → 303 session.url
        │                 │                 │
        ▼                 ▼                 ▼
   Express app (src/app.ts) — middleware order matters
   ┌──────────────────────────────────────────────┐
   │  1. GET /health                             │
   │  2. POST /webhooks/stripe — express.raw     │──► verify whsec → dedup webhook_events → mirror subscriptions
   │  3. express.json() + tenant + validate      │
   │  4. POST /generate → MeterService → QuotaService → usageRepo
   │  5. GET /usage → BillingService.rollup      │
   │  6. POST /checkout → Stripe sessions        │
   │  7. errorHandler (4xx never 500)             │
   └──────────────────────────────────────────────┘
                          │
                          ▼
   services/ (Meter, Quota, Pricing, Stripe, Billing)
   repos/ (tenant, subscription, usage, webhook — pg pool)
   config/pricing.ts (150/75/200 micro-cents) + env.ts
   jobs/ (node-cron 5m alerts, 2am reconciliation — pg advisory lock)
                          │
                          ▼
   PostgreSQL 16 (Docker 5433:5432) — 5 tables, 15 indexes
   ┌─────────┐  ┌───────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
   │ tenants │  │ plans │  │ subscriptions│  │ usage_events │  │webhook_events│
   └─────────┘  └───────┘  └──────────────┘  └──────────────┘  └──────────────┘
                          │ ux_usage_tenant_key (partial unique)  │
                          │ ix_usage_tenant_period (rollup)       │
```

### `capstone.yaml` skeleton (to copy to root)

```yaml
# capstone.yaml — manifest the evaluator reads per §10
run: "docker compose up -d && npm install && npm run migrate && npm run seed && npm run dev"
seed: "npm run seed"
test: "npm test" # optional but present for stretch
base_url: "http://localhost:3000"
endpoints:
  generate: "POST /generate"
  usage: "GET /usage?tenantId={id}"
  checkout: "POST /checkout"
  webhook: "POST /webhooks/stripe"
  health: "GET /health"
```

### What to react to

- **Diagram style — ASCII vs image:** ASCII is versionable, diffable, renders in GitHub markdown without binary asset, and matches brief's "image or ASCII sketch" allowance. Image would need `docs/assets/arch.png` and extra build step. Recommend ASCII for lean capstone; image can be polished later without changing semantics.
- **Run command:** Should be one-command that boots system from clean machine. Current proposes `docker compose up -d && npm run migrate && npm run seed && npm run dev` — does `npm install` belong there or in README setup steps? Should `PORT` be 3000 vs 3001 due to host 5432 conflict? Current uses 3000 + 5433 for DB, which works.
- **Endpoints list:** Does evaluator expect exact probing paths? Confirm `POST /generate` expects `Idempotency-Key` header and `X-Tenant-Id`, not just body tenantId.

## Links

- Design: `docs/DESIGN.md`, pricing: `src/config/pricing.ts`, Stripe: `docs/STRIPE.md`, ADRs `0001…0010`
