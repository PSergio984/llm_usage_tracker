# Overage billing & projected cost — allow over limit with per-unit premium

Stretch: when quota exceeded, do not hard-reject with 429/402 if overage is enabled for that tenant; instead allow the billable action, record its usage_event with `is_overage=true`, and calculate additional charges at a premium plus a `projected_cost` for month-end. Overage for API calls is `$0.01 per extra call` (1¢, integer), for tokens the same per-1k micro-cents rates as base (`INPUT 150 / OUTPUT 200`) but without free quota offset; `GET /usage` returns `{used, limit, overage: {api_calls, tokens, cost_cents}, projectedCostCents}` where `projected = current_total_cost + overage + (avg_daily_cost * remaining_days)`. Chosen over hard-reject all overages (core) or flat-invoice-after because the brief stretch asks for "+ projected cost" and needs an interview-story-worthy distinction between core micro-cents precision and stretch overage math; per-tenant toggle keeps core gate honest while stretch extends gracefully.

## Considered Options

- **Always hard-reject:** keeps core simple but wouldn't meet stretch "allow beyond limits and calculate additional" requirement.
- **Flat overage fee (e.g., $5 flat once over):** not proportional to real usage, loses money math credibility.
- **Overage with same rates as base:** too cheap to be premium story; premium per-call $0.01 gives clear monetization story.

## Consequences

- `MeterService` checks quota first; if `used+requested > limit` and `tenant.overage_enabled` → allow, flag `is_overage`, compute `overageCost` integer micro-cents, include `projectedCostCents` in rollup.
- Core clients (overage disabled) keep 429/402 path per ADR 0002; stretch clients get 200 with `X-Overage: true` header.
- Future invoice (ADR 0005) will line-item base quota cost + overage line.
