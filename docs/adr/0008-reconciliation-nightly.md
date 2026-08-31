# Reconciliation job — nightly Stripe vs DB comparison

Stretch task: nightly job (2am UTC cron `0 2 * * *`) lists Stripe subscriptions via `stripe.subscriptions.list({limit:100})` + `stripe.events.list` / or `stripe.billing.meter` equivalent, compares to local `subscriptions` + `usage_events` rollup per tenant+period and to `webhook_events` IDs, emitting diff report to `reconciliation_reports(id, run_at, diff jsonb, mismatches int)` and logging to `job_failures` on drift. Catches missed webhooks (e.g., `checkout.session.completed` not yet mirrored), forged-missed events, or manual Dashboard changes that bypass webhooks. Reports include `missing_in_db` (Stripe has sub but local doesn't), `missing_in_stripe` (local orphan), `status_mismatch`, `period_mismatch`. After detection, handler re-fetches authoritative Stripe subscription via `stripe.subscriptions.retrieve` and upserts local, then re-queues webhook handler for missing `event_id`. Chosen over relying solely on webhooks (webhooks can be missed, retried, or ordered differently) and over continuous polling (excessive API calls); nightly cadence balances $0 cost (one paginated list per run, ~1–2 calls) with next-day catch. First run is manual `npm run reconcile -- --dry-run` for dry verification; future `npm test` will assert reconciliation catches a forged-missing fixture.

## Considered Options

- **Webhook-only trust:** fails open if webhook lost, probe 4 replay test already expects dedup, but missed webhook would leave tenant Free→Pro stuck.
- **Continuous Stripe poll per request:** adds latency and hits rate limits, not needed when webhook is primary and reconciliation is safety net.

## Consequences

- Job is idempotent and read-only except upsert on mismatch; uses restricted key `rkcs_...` paginated list, so large tenant counts need cursor.
- Diff JSON is the EVIDENCE.md artifact for nightly correctness story.
