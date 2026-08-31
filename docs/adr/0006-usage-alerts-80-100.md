# Usage alerts at 80% and 100% via background job

Stretch: notify when a tenant crosses 80% and 100% of either quota (api_calls or ai_tokens) per period. A background job scans every 5 minutes (node-cron `*/5 * * * *` per ADR decision) reading `usage_events` rollup per tenant+period; when threshold crossed, it inserts into `usage_alerts(id uuid pk, tenant_id fk, period_start date, threshold int check (threshold in (80,100)), channel text, created_at)` with unique `(tenant_id, period_start, threshold)` to deduplicate per period (no duplicate 80% email if already sent), then dispatches via pluggable notifier: phase 1 console log + in-app flag `GET /usage` includes `alerts:[{threshold,triggered_at}]`; later stretches add email/webhook adapter behind `Notifier` interface. Retries use exponential backoff 3 tries with failure logged to `job_failures` and surfaced via `GET /health` per req #3 (≥1 background job retries + failure alert). Chosen over synchronous check in POST /generate handler (would couple request path to notification latency) and over daily batch (would miss near-real-time at boundary).

## Considered Options

- **Synchronous in handler:** adds latency to billable path, against layered "slow work off request path" principle.
- **Daily batch:** too late for 100% hard-reject to be helpful; 5-min scan balances freshness vs load.
- **Email only:** couples to external provider; console+in-app keeps $0 stack per brief.

## Consequences

- Job writes `usage_alerts` idempotently; `GET /usage` includes alerts so dashboard can render without polling email.
- Failure to notify is logged and health check reflects job lag.
