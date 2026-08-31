# Quota boundary hard-reject with 429 vs 402

At the exact plan limit (e.g., 1,000 API calls) the request that brings usage to exactly the limit is allowed; the next unit over the limit is rejected. When the tenant is on Free and exceeds Free limits, the response is `402 Payment Required` with `upgrade_url`; when the tenant is on Pro (highest tier) and exceeds Pro limits, the response is `429 Too Many Requests` with `Retry-After`; inactive/past-due subscriptions always get `402`. Chosen over permissive off-by-one and over single-code mappings because brief §2 requires boundary honesty at 999/1000/1001 and probes 2/3 check exact status codes and clear messages — a single `429` would conflate quota exhaustion (wait until next period) with upgrade need, while returning `200` over-limit would give away unlimited access.

## Considered Options

- **Allow 1001st with 200:** gives away unlimited access — loses revenue, fails boundary-honesty trap.
- **Always 429 for any over-limit:** conflates Free upgrade case (needs 402 + upgrade_url) with Pro exhaustion (needs Retry-After), evaluator expects both codes distinct.
- **Always 402:** mislabels Pro quota exhaustion as payment issue when subscription is active and paid.

## Consequences

- `429` carries `Retry-After` header (seconds to `period_end`) and JSON `{reason:"quota_exceeded", used, limit, period_end, retry_after}`.
- `402` carries JSON `{reason:"payment_required", used, limit, upgrade_url}` where `upgrade_url` points to `POST /checkout`.
- Quota check is `current_period_sum + requested > limit` before insert; idempotent replay with stored key returns original `200` without re-checking current quota (replay is not a new consumption).
