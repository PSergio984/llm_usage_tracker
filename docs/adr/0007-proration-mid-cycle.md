# Proration — mid-cycle upgrade fair charge

Stretch: when tenant upgrades mid-period (e.g., Free→Pro on day 15 of 30-day month), charge fair partial amount and split quotas/usage for period. Formula: `prorated_cost = (remaining_days / total_days_in_period) * plan_price_difference` plus usage already incurred under old plan stays at old rates, new usage after upgrade at new plan rates; usage rollup for period is split at `subscriptions.current_period_start` change via `stripe.subscription.updated` event's `billing_cycle_anchor` / `proration_behavior:'create_prorations'` (Stripe creates proration invoice items). Our DB stores `subscriptions.current_period_start/end` mirrored from Stripe; invoice generation (ADR 0005) creates two invoice segments when a period contains a plan change: segment 1 (day1..day14) at Free limits, segment2 (day15..end) at Pro limits, with `proration` line item. Chosen over ignoring intra-month upgrades (would overcharge or give free days) and over always resetting period on upgrade (would lose Stripe alignment); Stripe's proration behavior is the source of truth, we mirror it rather than re-derive, keeping reconciliation job's nightly comparison honest.

## Considered Options

- **Reset period on upgrade:** loses alignment with Stripe billing_cycle_anchor, breaks webhook sync.
- **Charge full Pro price regardless of day:** penalizes early-month vs late-month upgrades inconsistently.
- **Ignore usage split, just flip plan:** reporting shows period usage at new quota only, historical Free usage would incorrectly count against Pro.

## Consequences

- `subscriptions.updated` handler must store new `period_start` and keep old period's usage_events with original `billing_period_start`; new period uses new date_trunc slice.
- `GET /usage` for current period after upgrade shows blended limits (free segment already consumed + pro remaining) via `proration` helper.
