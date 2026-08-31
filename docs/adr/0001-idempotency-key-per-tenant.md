# Idempotency-Key per tenant with stored response replay

Tenant-scoped `Idempotency-Key` header (required on `POST /generate`) backed by a partial unique index `(tenant_id, idempotency_key) WHERE key IS NOT NULL` on `usage_events` that also stores `request_hash` + `response_status/response_body`; replay with same key and same hash returns the stored response byte-identical without inserting a new event. Chosen over global-key, body-field, or optional-key alternatives because per-tenant scope prevents cross-tenant leakage, header is HTTP-idiomatic, required-key fails fast on retries, and storing hash detects key reuse with different payload (422) — all required for Probe 1 no-double-charge guarantee; concurrent races resolved atomically via `INSERT … ON CONFLICT DO NOTHING` + `SELECT` fallback.

## Considered Options

- **Global key (no tenant scope):** leak — tenant A's key could replay tenant B's response.
- **Body field key:** not HTTP-idiomatic; proxies and middleware treat headers as the idempotency carrier.
- **Optional key:** allows exactly-once to be skipped → double-charge bug under retry.

## Consequences

- `400` if header missing/empty; `422 idempotency_key_reused` if same tenant+key but `request_hash` differs.
- Keys retained at least for billing period (≥24h); duplicate within period replays, outside period is undefined until explicitly expired (future cleanup job).
- Insert path must use atomic conflict handling, not application-level check-then-insert.
