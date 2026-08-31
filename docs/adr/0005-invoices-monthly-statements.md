# Invoices — monthly statements with usage line items

Stretch: generate a monthly invoice per tenant/period that is the auditable statement of the rollup. Table `invoices(id uuid pk, tenant_id fk, period_start date, period_end date, currency text default 'USD', status text check ('draft','final','void'), line_items jsonb, subtotal_cents int, overage_cents int, total_cents int, created_at)` with unique `(tenant_id, period_start)`; line items array `[{type:'api_call', description:'1,000 API calls x $0', quantity, rate_microcents, amount_microcents}, {type:'ai_tokens', breakdown:{input,cached,output,reasoning}, quantity, rate, amount}]` plus base quota cost + overage line when applicable (links to ADR 0004). Generation is a background job at month-end (or on-demand `POST /invoices/generate` for testing) that idempotently inserts via `ON CONFLICT DO NOTHING` after rolling up `usage_events` per period using same integer micro-cents math as `pricing.ts`; `GET /invoices?tenantId& period=YYYY-MM` returns statement; `GET /invoices/:id.pdf` is out of scope for core, JSON is source of truth, PDF is later. Chosen over invoice-per-event or manual spreadsheet because evaluators can probe `EVIDENCE.md` invoice line-item totals and subscription period sync via webhooks must feed `current_period_start/end` to period boundaries.

## Considered Options

- **No invoice table, just rollup:** loses auditability and disputes need receipts (Stripe guide requirement).
- **Invoice per usage_event:** spammy, not monthly statement shape evaluators expect.

## Consequences

- Background job retries with idempotent `ON CONFLICT` on `(tenant_id, period_start)`; draft→final transition after period end.
- Proration (ADR 0006) will split period when plan changes mid-cycle, creating two invoices for split period.
