-- 001_init.sql — tenants, plans, subscriptions, usage_events, webhook_events
-- Per docs/DESIGN.md; idempotency via partial unique index, period rollup index

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tenants
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  stripe_customer_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Plans (Free / Pro) — seed below, but table hard-locks quotas
CREATE TABLE IF NOT EXISTS plans (
  code TEXT PRIMARY KEY CHECK (code IN ('free','pro')),
  name TEXT NOT NULL,
  api_quota INTEGER NOT NULL CHECK (api_quota > 0),
  token_quota INTEGER NOT NULL CHECK (token_quota > 0),
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0)
);

INSERT INTO plans (code, name, api_quota, token_quota, price_cents) VALUES
  ('free', 'Free', 1000, 100000, 0),
  ('pro', 'Pro', 10000, 1000000, 1500)
ON CONFLICT (code) DO NOTHING;

-- Subscriptions — mirrors Stripe truth via webhooks only
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE NOT NULL,
  stripe_customer_id TEXT,
  stripe_price_id TEXT,
  plan_code TEXT NOT NULL REFERENCES plans(code),
  status TEXT NOT NULL CHECK (status IN ('active','past_due','canceled','incomplete','trialing','unpaid')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_subscriptions_tenant_active
  ON subscriptions(tenant_id) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS ix_subscriptions_tenant ON subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS ix_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);

-- Usage events — one row per billable action, idempotency per tenant, period partitioning via generated column
CREATE TABLE IF NOT EXISTS usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('api_call','ai_tokens')),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  input_tokens INTEGER NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  cached_input_tokens INTEGER NOT NULL DEFAULT 0 CHECK (cached_input_tokens >= 0),
  output_tokens INTEGER NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  reasoning_tokens INTEGER NOT NULL DEFAULT 0 CHECK (reasoning_tokens >= 0),
  idempotency_key TEXT NOT NULL,
  request_hash TEXT,
  response_status INTEGER,
  response_body JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  billing_period_start DATE NOT NULL DEFAULT (date_trunc('month', now())::date)
);

-- Exactly-once per tenant+key (Advisor: core double-charge bug prevention)
CREATE UNIQUE INDEX IF NOT EXISTS ux_usage_tenant_key
  ON usage_events(tenant_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Rollup per tenant+period (GET /usage)
CREATE INDEX IF NOT EXISTS ix_usage_tenant_period
  ON usage_events(tenant_id, billing_period_start);

CREATE INDEX IF NOT EXISTS ix_usage_tenant_created ON usage_events(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS ix_usage_tenant_type ON usage_events(tenant_id, type);

-- Webhook events — deduplication for replay ignored (Probe 4)
CREATE TABLE IF NOT EXISTS webhook_events (
  event_id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_webhook_type ON webhook_events(type);

-- Updated_at trigger for subscriptions
CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
