# Usage Metering & Billing Engine

Backend service that answers how much a tenant has used, what it costs, and whether they have hit their plan limit.

## Language

**Tenant**:
One customer organization in a multi-tenant system. Every usage event, plan, and subscription belongs to exactly one tenant, and tenants never see each other's data.
_Avoid_: Customer, account, organization

**Usage Event**:
One recorded row of billable activity: tenant, type (API call / tokens), quantity, timestamp, and idempotency key.
_Avoid_: Record, entry, log line

**Idempotency Key**:
An opaque unique value sent with a billable request so a retry can be recognized as already done — the mechanism that prevents double-counting.
_Avoid_: Deduplication key, request ID

**Quota**:
A plan's monthly allowance (e.g., 1,000 API calls, 100k tokens) enforced before the action, not after.
_Avoid_: Limit, allowance

**Plan**:
A named tier (Free / Pro) that bundles quotas and price for a billing period.
_Avoid_: Tier, subscription (subscription is an instance of a plan)

**Subscription**:
A tenant's current period instance of a plan, mirrored from Stripe truth via verified webhooks.
_Avoid_: Plan (the template), membership

**Rollup**:
Aggregating many usage events into one summary per tenant and period: used, limit, cost.
_Avoid_: Aggregation, summary

**Cached Input Tokens**:
Input tokens the AI provider already had cached — billed cheaper than fresh input.
_Avoid_: Cached tokens

**Reasoning Tokens**:
Hidden thinking tokens a model produces — billed as output tokens, not a separate free category.
_Avoid_: Thinking tokens, hidden tokens
