# Prototype — Stripe Checkout & webhook handler skeleton

**Ticket:** [Prototype — Stripe Checkout & webhook handler skeleton](https://github.com/PSergio984/llm_usage_tracker/issues/10) · `wayfinder:prototype` · HITL  
**Branch:** `prototype/stripe-checkout-webhook`  
**Purpose:** Raise fidelity of Checkout flow + verified webhook handling — stub runnable with `stripe trigger` locally, capturing red/green transcript shape for Probes 3 & 4 (Stripe Checkout flip, forged/replay webhooks). Throwaway, not shipped.

## What this prototype is (and is not)

- **Is:** A minimal vertical slice: `POST /checkout` creates Stripe Checkout Session (Pro), Stripe-hosted page with test card `4242…`, `POST /webhooks/stripe` verifies `Stripe-Signature` with `whsec_` on raw body, deduplicates via `webhook_events(event_id PK)`, mirrors subscription plan/status to tenant. Shows where raw-body middleware must sit isolated from `express.json()`.
- **Is not:** Final subscription state machine, proration, or full invoice handling (those are stretches). No real DB wiring beyond SQL shapes.

## Checkout + webhook flow (ASCII)

```
Browser                App (Express)                         Stripe (test mode + CLI)
  |                          |                                      |
  |-- POST /checkout -------->|                                      |
  |   {tenantId, plan:"pro"} |  lookup STRIPE_PRICE_PRO             |
  |                          |-- stripe.checkout.sessions.create --->|
  |                          |   mode:'subscription'                |
  |                          |   line_items:[{price: price_1Pro}]    |
  |                          |   success_url: /success?session_id   |
  |                          |<-- session {url, id, customer} -------|
  |<-- 200 {url} ------------|                                      |
  |-- GET session.url ------>|                                      |-- 4242 card ->
  |   Stripe-hosted page     |                                      |   checkout.session.completed
  |                          |<-- webhook POST /webhooks/stripe ----|   + signature Stripe-Signature: t=...,v1=...
  |                          |   express.raw({type:'application/json'})|
  |                          |   stripe.webhooks.constructEvent(raw, sig, whsec) → 400 on bad
  |                          |   INSERT webhook_events(event_id) ON CONFLICT DO NOTHING → if 0 rows → replay ignored
  |                          |   switch event.type:
  |                          |     checkout.session.completed → retrieve session → customer, subscription → upsert tenants/subscriptions plan=pro status=active
  |                          |     customer.subscription.updated → update plan/status
  |                          |     customer.subscription.deleted → mark canceled → maybe revert to free
  |                          |--> 200                               |
  |-- GET /usage ------------>|-- BillingService.rollup ----------->|
  |<-- {plan:"pro", usage}---|                                      |
```

## Files in this prototype branch

| File | React to |
|------|----------|
| `src/routes/checkout.stub.ts` | Session creation with `lookup_key → priceId` vs hard-coded `STRIPE_PRICE_PRO`, `success_url` shape, redirect |
| `src/routes/webhooks/stripe.stub.ts` | Raw-body isolation, `constructEvent`, `400` on forged, `webhook_events` dedup, switch on 3 events |
| `src/services/StripeService.stub.ts` | `handleEvent()` that mirrors Stripe truth to `subscriptions` (tenant plan/status) |
| `src/repos/subscriptionRepo.stub.ts` | `upsertSubscription` + `findActive(tenantId)` shapes |
| `src/repos/webhookEventRepo.stub.ts` | `tryInsert(event_id)` with `ON CONFLICT DO NOTHING` for replay ignore |
| `src/middleware/rawBody.stub.ts` | Shows why `express.json()` must NOT be global before webhook route |
| `docs/STRIPE.md` (existing) | Provisioning already done — this prototype reuses its sandbox keys/price IDs |

## How to run this prototype once graduated (recipe to prove gate)

Per `docs/STRIPE.md` provisioning + research `stripe-integration` doc:

```bash
# Terminal A — app with real handlers (once stubs are copied to src/*.ts and PORT=3000)
npm run dev
# Terminal B — forward signed events, prints whsec_ for this session
stripe listen --events checkout.session.completed,customer.subscription.updated,customer.subscription.deleted --forward-to localhost:3000/webhooks/stripe
#   → Ready! Your webhook signing secret is whsec_...
#   Copy to .env as STRIPE_WEBHOOK_SECRET and restart app

# Terminal C — no browser needed
stripe trigger checkout.session.completed          # → app logs 200, webhook_events inserted
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted
# Replay proof:
stripe trigger checkout.session.completed          # same event_id → handler does INSERT ON CONFLICT → 0 rows → ignored → still 200 but no duplicate plan flip
# Forged proof:
curl -X POST localhost:3000/webhooks/stripe -H "Stripe-Signature: t=0,v1=bad" -H "Content-Type: application/json" -d '{"bad":true}'
#   → 400 {error:"webhook_signature_verification_failed"}
```

Red path (forged →400, nothing changes) and green path (`.completed` flips Free→Pro, `GET /usage` shows new limit) are the two transcripts required for `EVIDENCE.md` Probe 3 + 4.

## Open questions surfaced

- **Ordering:** Should `checkout.session.completed` handler fetch full Subscription via `stripe.subscriptions.retrieve(event.data.object.subscription)` to avoid needing separate `.updated` for status, or rely on `.updated` arriving separately (SO caveat)? Prototype shows switch on all three, but notes that fetching is safer if you need authoritative state.
- **Subscription vs tenant mapping:** Should `checkout.session.completed` create `customer` if absent (`stripe_customer_id` on tenant), or require pre-existing customer? Prototype assumes `stripe.customers.create` on tenant first-seen.
- **Invoice vs checkout:** Do we also need to handle `invoice.paid`/`payment_failed` for monthly renewal, or is `customer.subscription.*` sufficient for core? Prototype limits to three events per capstone §4; invoice events are fog for stretch.
- **Error handling:** On `constructEvent` exception, do we log with `err.message` but never log raw body/secret? Prototype leaves as stub to decide per secrets hygiene (req #6).
