# Full deterministic test suite one-command

Stretch task: a single `npm test` that deterministically exercises the scary cases without external tunnels. Suite uses `vitest` + `supertest` against Express app with `pg` test DB (isolated tenant per test via `tenant_id` uuid) and `stripe.webhooks.generateTestHeaderString` for signed webhook fixtures. Cases: (1) double-send same `Idempotency-Key` with same hash → exactly one `usage_events` row, second response byte-identical (Probe 1); (2) same key with different `request_hash` → 422; (3) concurrent double-send (Promise.all two same-key inserts) → one row via `ON CONFLICT`; (4) boundary: seed 999 api_calls, POST 1 allowed → 1000, next POST 1 → 429 `quota_exceeded` + `Retry-After` (Probe 2 Free→429? Actually Pro exhaustion), or Free over → 402 `payment_required` + `upgrade_url`; (5) Checkout flip: `stripe trigger checkout.session.completed` fixture signed with test `whsec_` → handler inserts `webhook_events` + flips tenant `free→pro`, subsequent `GET /usage` shows new limit 10k/1M (Probe 3); (6) forged webhook (`Stripe-Signature: bad`) → 400 nothing changes + replay same valid `event_id` twice → second ignored (Probe 4); (7) pricing: 1500 input +500 cached +2500 output+1000 reasoning → `calculateTokenCost` returns 1175 µ¢ → 2¢ and `GET /usage` matches (Probe 5); (8) tenant isolation: tenant A usage not visible to tenant B rollup; (9) reconciliation dry-run diff empty when DB mirrors stub Stripe list. Each case prints a transcript line for `EVIDENCE.md` per Section 6 "one pasted proof per box" — test output or curl transcript, not just claim. `npm run test` is deterministic (no sleep, no flake), runs migrations in `beforeAll`, truncates `usage_events` per test, and uses `STRIPE_WEBHOOK_SECRET` from `.env` for header helper. Chosen over manual curl-only because the evaluator's one-command probe (`test:` in `capstone.yaml`) is optional but interview-story strong, and the `EVIDENCE.md` proofs are machine-checkable minutes vs human-checked hours.

## Considered Options

- **Manual curl only:** evaluator must run curls by hand, not one-command, loses determinism and CI story.
- **Stripe trigger only:** fixture not covering every business metadata case; in-process `generateTestHeaderString` gives hermetic signed request tests without needing `stripe listen` running.

## Consequences

- Tests use integer micro-cents assertions, never float comparison.
- `package.json` `test: "vitest run"` and `capstone.yaml` `test:` point to same command; `vitest` reporters capture output for `EVIDENCE.md`.
