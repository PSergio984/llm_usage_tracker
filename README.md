# Usage Metering & Billing Engine

Backend service every SaaS needs: how much has this tenant used, what does it cost, and have they hit their limit? Metering, quotas, correct money math, and Stripe test mode — where correctness really matters.

## What it does

- **Metering (exactly-once):** `POST /generate` records one `usage_events` row per tenant+Idempotency-Key. Retries with same key replay the stored response byte-identical; different payload with same key → `422 idempotency_key_reused`; missing key → `400`.
- **Quota enforcement (honest boundaries):** `999+1→1000` allowed, `1001st` rejected. Free over Free → `402 payment_required` + `upgrade_url`, Pro over Pro → `429 quota_exceeded` + `Retry-After`; replay of stored key bypasses quota re-check.
- **Cost calculation (money math):** `src/config/pricing.ts` pins `INPUT 150 / CACHED 75 (½) / OUTPUT 200` micro-cents per 1k, reasoning billed as output, categories not naively summed → `1175→2¢` example. Stored as integers, never floats.
- **Stripe test mode:** `POST /checkout` creates Checkout Session (`mode:subscription`, `price_1UAOfn…` $15), Stripe-hosted page with test card `4242 4242 4242 4242`, webhooks `checkout.session.completed` → flip `free→pro`, `customer.subscription.updated/deleted` → mirror status. Webhook verifies `whsec_` on raw body → `400` forged, `webhook_events(event_id PK)` dedup → replay ignored.

Two plans, two usage types (`api_call` + `ai_tokens`), one dummy billable endpoint (`POST /generate`), no real AI key needed — token counts are simulated numbers.

## Architecture

```
Client (curl / vitest / Stripe CLI)
        │
        ├── POST /generate (Idempotency-Key + X-Tenant-Id) ─┐
        ├── GET /usage (?tenantId) ─────────────────────────┤
        ├── POST /checkout ─────────────────────────────────┤
        └── POST /webhooks/stripe (Stripe-Signature) ───────┘
                             │
                             ▼
                   Express app (src/app.ts)
         ┌────────────────────────────────────────────┐
         │  GET /health                               │
         │  POST /webhooks/stripe — express.raw       │──► verify whsec → webhook_events PK dedup → StripeService
         │  express.json() + tenantMiddleware         │
         │  POST /generate → MeterService → QuotaService → usageRepo (ON CONFLICT)
         │  GET /usage → BillingService.rollup → pricing.ts
         │  POST /checkout → stripe.checkout.sessions.create
         │  errorHandler (Zod 400, AppError 4xx, 500 never leak)
         └────────────────────────────────────────────┘
                             │
                             ▼
                services/ (Meter, Quota, Pricing, Billing, Stripe)
                repos/ (tenant, subscription, usage, webhook — pg pool)
                config/pricing.ts (integer micro-cents) + env.ts (zod)
                jobs/ (node-cron 5m alerts, 2am reconciliation — pg advisory lock, stub)
                             │
                             ▼
                PostgreSQL 16 (Docker 5433:5432) — 5 tables, 15 indexes
                tenants | plans (free 1k/100k, pro 10k/1M) | subscriptions | usage_events (ux_usage_tenant_key partial unique, ix_usage_tenant_period) | webhook_events
```

Layered architecture: data / logic / HTTP separated per req #1; validation at boundary → `400`; ≥1 background job off request path (alerts + reconciliation) with retries + failure log; real persistence via migrations; idempotency where it matters; secrets in `.env` git-ignored.

## Quick start (one-command per capstone.yaml)

Prereqs: Node 22, Docker Desktop, Stripe CLI (`winget install Stripe.StripeCLI` or `scoop install stripe`).

```bash
git clone https://github.com/PSergio984/llm_usage_tracker
cd llm_usage_tracker
cp .env.example .env
# fill STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET / STRIPE_PRICE_PRO from stripe sandbox create (see docs/STRIPE.md)
# Or: stripe sandbox create --from-git --non-interactive → rkcs_test_... + pk_test... + whsec_... via stripe listen --print-secret
# Or: stripe login --interactive (paste sk_test_...)

docker compose up -d          # Postgres 16 on 5433 (host 5432 conflicts with host postgres-x64-18)
npm install
npm run migrate                # applies migrations/001_init.sql (5 tables + 15 indexes)
npm run seed                   # seeds 2 deterministic tenants: Acme free 00000000-0000-4000-a000-000000000001, Globex pro 00000000-0000-4000-a000-000000000002
npm run dev                    # http://localhost:3000

# in another terminal, forward signed webhooks to localhost:
stripe listen --events checkout.session.completed,customer.subscription.updated,customer.subscription.deleted --forward-to localhost:3000/webhooks/stripe
# copy its whsec_... into .env STRIPE_WEBHOOK_SECRET and restart dev

# smoke test without browser:
stripe trigger checkout.session.completed
curl http://localhost:3000/tenants  # lists deterministic tenants above
curl -H "X-Tenant-Id: 00000000-0000-4000-a000-000000000001" -H "Idempotency-Key: k1" -H "Content-Type: application/json" -d '{"type":"api_call","quantity":1}' http://localhost:3000/generate
curl -H "X-Tenant-Id: 00000000-0000-4000-a000-000000000001" http://localhost:3000/usage
curl http://localhost:3000/health
curl -H "Content-Type: application/json" -d '{"name":"My Tenant"}' http://localhost:3000/tenants  # create tenant for probe

# one-command per capstone.yaml run:
docker compose up -d && npm install && npm run migrate && npm run seed && npm run dev
```

Seed creates deterministic tenants (`00000000-0000-4000-a000-000000000001` Free, `...0002` Pro) on `ON CONFLICT DO UPDATE`; evaluator can also `POST /tenants {"name":"My Tenant"}` or `GET /tenants` to discover IDs (no auth).

## Plans & quotas

Documented per brief §4: Free `1,000 API / 100k tokens`, Pro `10,000 API / 1M tokens` (10×, in DB `plans` table and `docs/DESIGN.md`). Pricing pinned in `src/config/pricing.ts` as above.

## Stripe test mode ($0, no card)

- Sandbox: `stripe sandbox create --from-git` → `rkcs_test_...` + `pk_test_...` (7-day, `claim_url` in `docs/STRIPE.md`).
- Products: `prod_VAkAqI3t32RJDU` Free ($0), `prod_VAkA7Rmo6a7YXR` Pro ($15) and prices `price_1UAOfl…`/`price_1UAOfn…` already in `STRIPE.md`.
- CLI forward: `stripe listen --print-secret` → `whsec_...` (ephemeral per `stripe listen` session) into `.env`. Never commit `.env` (`.gitignore:2:.env` verified via `git check-ignore -v .env`), use `.env.example` placeholders.

## Test

```bash
npm test                  # vitest run — 19 tests: pricing 5, idempotency 5 (Probe1), quota 4 (Probe2), webhooks 5 (Probe3/4 + isolation)
npx tsc --noEmit          # typecheck
```

## Limitations (honest)

- `POST /generate` is a dummy billable endpoint; no real AI model call — token counts are simulated numbers you pass.
- `POST /checkout` creates Checkout Session but does not render frontend; you redirect to `session.url` yourself.
- Overage billing, invoices, alerts, proration, reconciliation, and full deterministic suite beyond the 19-test core are **spec'd as ADRs 0004–0009** and `src/jobs/` (node-cron `5m` alerts + `2am` reconciliation with `pg_try_advisory_xact_lock` now wired in `src/index.ts:1` per code-review fix). The 19-test suite covers Probes 1–5, tenant isolation, and the scary cases; stretches are gated on core.
- Host port `5433` is used because `postgresql-x64-18` already listens on `5432`; change back to `5432:5432` in `docker-compose.yml` if host postgres is stopped.

## Required files per Section 10

- `README.md` (this), `capstone.yaml` (`run`/`seed`/`test`/`base_url`+endpoints), `EVIDENCE.md` (one proof per Section 6 box), `BUILDLOG.md` (AI log), `.env.example` (placeholders), `docker-compose.yml`, `migrations/001_init.sql`, `src/` layered + `src/config/pricing.ts`.
