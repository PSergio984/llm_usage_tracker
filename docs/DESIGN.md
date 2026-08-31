# Phase 1 Design — Usage Metering & Billing Engine

Gate 1 (Section 8): one-page doc covering problem, data model, API surface, layer sketch, one explicit non-goal. Committed per §8 Gate.

## Problem

Every SaaS must answer: how much has this tenant used, what does it cost, have they hit their limit? Retries must never double-charge, webhooks may replay, quota boundary (999/1000/1001) must be honest (429/402 + message + Retry-After), token pricing must respect cached-cheaper (½) and reasoning=output without naive sums, Stripe test mode is truth via verified webhooks only. Bugs here cost real money or give away unlimited access.

## Data model

PostgreSQL via Docker, migrations as `migrations/*.sql` (run on `npm run migrate`). Single table per tenant with `tenant_id` + indexes (not separate schemas) — tenant isolation via `WHERE tenant_id=$1` and partial indexes, cheaper than RLS for core, app-enforced; RLS added later as hardening.

```
tenants(id uuid pk default gen_random_uuid(), name text not null, stripe_customer_id text unique, created_at timestamptz default now())
plans(code text pk check (code in ('free','pro')), name text not null, api_quota int not null, token_quota int not null, price_cents int not null)
  seed: ('free','Free',1000,100000,0), ('pro','Pro',10000,1000000,1500)
subscriptions(id uuid pk default gen_random_uuid(), tenant_id uuid fk tenants(id) on delete cascade, stripe_subscription_id text unique not null, stripe_price_id text, stripe_customer_id text, plan_code text fk plans(code) not null, status text check (status in ('active','past_due','canceled','incomplete')) not null, current_period_start timestamptz, current_period_end timestamptz, created_at timestamptz, updated_at timestamptz, unique(tenant_id) where status='active')
usage_events(id uuid pk default gen_random_uuid(), tenant_id uuid fk tenants(id) not null, type text check (type in ('api_call','ai_tokens')) not null, quantity int not null check (quantity>0), input_tokens int default 0, cached_input_tokens int default 0, output_tokens int default 0, reasoning_tokens int default 0, idempotency_key text not null, request_hash text, response_status int, response_body jsonb, created_at timestamptz default now(), billing_period_start date generated as date_trunc('month', created_at)::date stored)
  unique index: CREATE UNIQUE INDEX ux_usage_tenant_key ON usage_events(tenant_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
  rollup index: CREATE INDEX ix_usage_tenant_period ON usage_events(tenant_id, billing_period_start);
webhook_events(event_id text pk, type text not null, payload jsonb not null, processed_at timestamptz default now())
```

Stripe is truth; `subscriptions` mirrors it only through verified webhook events. `usage_events` stores both request hash and first response for idempotent replay; billing period is calendar month UTC (`date_trunc`).

## Plans & quotas (locked Q4/Q5)

- Free: 1,000 API calls + 100,000 AI tokens / month
- Pro: 10,000 API calls + 1,000,000 tokens / month (10×). Documented in README.
- Pricing pinned in `src/config/pricing.ts` as integer micro-cents per 1k tokens (never floats): `INPUT=150 (0.0015/1k), CACHED=75 (½), OUTPUT=200 (0.002/1k)`, reasoning billed at OUTPUT. API-call cost 0 in core (metered but free); stretch overage adds price. Cost math: `cost = ceil(input/1000)*INPUT + ceil(cached/1000)*CACHED + ceil((output+reasoning)/1000)*OUTPUT`. Stored as `cost_cents` integer. Proved in `EVIDENCE.md`.

## Metering API contract & idempotency (Q6/Q7)

Tenant identity: `X-Tenant-Id` header (uuid, validated at boundary; missing/invalid → 400). Alternatives (subdomain, JWT) are later ADRs.

```
POST /generate  Idempotency-Key: <opaque>  X-Tenant-Id: <uuid>
Body: { type: "api_call", quantity: 1 } | { type: "ai_tokens", tokens: { input: int, cached_input: int, output: int, reasoning: int } }
Validation → 400 on bad shape (never 500).
Flow: validate → compute requested = quantity or sum tokens → SELECT coalesce(sum) WHERE tenant_id AND billing_period_start=current_month → if sum+requested > plan quota → 429 {reason:"quota_exceeded", used, limit, retry_after, upgrade_url} (token quota) or 402 {reason:"payment_required"} (payment/Pro required) + Retry-After header → else attempt INSERT into usage_events with idempotency_key; on unique violation → SELECT original response and return it byte-identical (Probe 1). On success → return 200 {id, used, limit, cost_cents}.
TTL: keys live at least for billing period; 24h minimum; no expiry within month needed for Probe 1.

GET /usage?tenantId=<uuid> → { period_start, period_end, plan: "free"|"pro", usage: {api_calls:{used,limit}, ai_tokens:{used,limit}}, cost_cents, cost_breakdown }
GET /health → 200
POST /webhooks/stripe  (raw body, no json parser before verify)
POST /checkout  { tenantId, plan:"pro" } → { url }  (Stripe Checkout Session)
```

Boundary rule (Q7 hard reject): 0–1000 inclusive allowed, 1001st rejected. Probe at 999 allowed, 1000 allowed, 1001 → 429/402.

## Layer sketch (Q11 layered architecture)

```
src/
  app.ts           express app, middleware (validate, error, raw-body for /webhooks/stripe)
  routes/          generate.ts, usage.ts, checkout.ts, webhooks.ts, health.ts
  services/        MeterService.record(), QuotaService.check(), PricingService.calculate(), StripeService.handleWebhook(), BillingService.rollup()
  repos/           tenantRepo, subscriptionRepo, usageRepo, webhookEventRepo (pg pool)
  config/          pricing.ts (integer constants), env.ts (zod)
  jobs/            alerts.ts (80/100% scan every 5min, BullMQ or setInterval), reconciliation.ts (nightly stripe vs db)
  migrations/      001_init.sql
  middleware/      idempotency.ts, tenant.ts
```

Validation at boundary (zod) → 4xx; service throws `AppError(status)`. Background job ≥1 off request path with retries + failure log (meets req #3). Secrets via `.env` (git-ignored) + `.env.example`; encrypted if stored, never logged (req #6). Tests: `npm test` deterministic, probes 1–5 transcripts in `EVIDENCE.md`.

## One explicit non-goal

**No invoicing, proration, or overage billing in core.** Section 7 keeps core to 2 plans × 2 usage types × 1 dummy billable endpoint. Those are stretches gated on core correctness; adding them now would obscure the idempotency/quota/money-math guarantees that must be proven first. Over-alerts, invoices, proration mid-cycle, and reconciliation graduate from separate stretch tickets after core is green and probes pass.
