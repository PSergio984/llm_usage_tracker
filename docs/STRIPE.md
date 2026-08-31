# Stripe Test Mode Provisioning

Per Wayfinder Task #5 — Provision Stripe test mode & local webhook delivery.

## Sandbox

- **Provisioned via:** `stripe sandbox create --from-git --non-interactive` (anonymous, proof-of-work, no credit card)
- **Account ID:** `acct_1UA7w0RMZHQ0shBo`
- **Publishable key:** `pk_test_51UA7w0RMZHQ0shBohJuH6FvdfMaqYEWLyvWBtwvEIA9QTGKHMYL9kSxAPXNIVB72tLvgxVsK68viPb7ZTbGjE8rw00SwpYkaA5` (from `stripe config --list`)
- **Secret key (restricted):** `rkcs_test_51UA7w0...` stored in `.env` as `STRIPE_SECRET_KEY` — see `stripe config --list` `test_mode_api_key`. Full value is in local `.env` (git-ignored). Claim URL: `https://dashboard.stripe.com/onboard_sandbox/YWNjdF8xVUE3dzBSTVpIUTBzaEJvLDE3ODg3NjIzNDAv100pPhE5Rt5` — expires `2026-09-07` (7 days). Run `stripe sandbox claim` to claim before then.
- **Sandbox type:** `rkcs_...` indicates restricted key; sufficient for Products/Prices/Checkout/Sandbox events. For full `sk_test_` workflow, claim sandbox via browser or use `stripe login --interactive`.

## Products & Prices

Created 2026-08-31 via Stripe CLI (test mode):

```
stripe products create --name "Free Plan" --description "Free tier 1k API 100k tokens"
  → prod_VAkAqI3t32RJDU

stripe prices create --product prod_VAkAqI3t32RJDU --currency usd --unit-amount 0 --recurring.interval month --nickname "free-monthly"
  → price_1UAOflRMZHQ0shBo3nH2E48m   (Free, $0)

stripe products create --name "Pro Plan" --description "Pro tier 10k API 1M tokens"
  → prod_VAkA7Rmo6a7YXR

stripe prices create --product prod_VAkA7Rmo6a7YXR --currency usd --unit-amount 1500 --recurring.interval month --nickname "pro-monthly"
  → price_1UAOfnRMZHQ0shBochirtXWT  (Pro, $15.00/month)
```

These IDs are copied into `.env` (`STRIPE_PRODUCT_FREE`, `STRIPE_PRICE_FREE`, `STRIPE_PRODUCT_PRO`, `STRIPE_PRICE_PRO`) and mirrored as placeholders in `.env.example`. Checkout sessions should use `STRIPE_PRICE_PRO` for `mode:'subscription'`.

## Webhook delivery (local)

- **Endpoint in app:** `POST /webhooks/stripe` — must use `express.raw({type:'application/json'})` **before** any `express.json()` for that route.
- **Verification:** `stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET)` → forged `400`.
- **Local forwarding:**
  ```bash
  # Terminal A — run app first
  npm run dev  # PORT=3000

  # Terminal B — forward signed events; prints whsec_ for this session
  stripe listen --events checkout.session.completed,customer.subscription.updated,customer.subscription.deleted --forward-to localhost:3000/webhooks/stripe
  # Output: Ready! Your webhook signing secret is whsec_...
  # Copy that whsec_ into .env as STRIPE_WEBHOOK_SECRET and restart server

  # Print only secret and exit (used for provisioning):
  stripe listen --print-secret
  #   → whsec_...redacted... (session ephemeral, changes per listen)
  ```

- **Ephemeral whsec:** The `whsec_` from `stripe listen` is per CLI session, separate from Dashboard endpoint `whsec_`. For local dev, use the CLI one; for deployed, register endpoint in Dashboard Workbench and use that secret. Local `.env` currently holds the latest `whsec_...redacted... re-run `stripe listen --print-secret` after sandbox expiry or new session.
- **Replay / trigger (no browser):**
  ```bash
  stripe trigger checkout.session.completed
  stripe trigger customer.subscription.updated
  stripe trigger customer.subscription.deleted
  # Each creates fixture data + emits event. For business-specific metadata tests, create sandbox Checkout via API instead of trigger.
  ```

## Environment files

- **`.env.example`** — committed, placeholders only (no real secrets). Human copies to `.env` and fills from sandbox output.
- **`.env`** — local only (git-ignored via `.gitignore:2`), holds real `rkcs_test_` + `whsec_` + price IDs. Never commit, even test keys — hygiene fail per brief §3.
- **To prove forwarding once server exists:** run app on :3000, then in B run `stripe listen --forward-to`, in C run `stripe trigger checkout.session.completed`, observe handler logs `200` and `webhook_events` row inserted, then replay same `stripe trigger` and observe duplicate `event_id` ignored (`ON CONFLICT DO NOTHING`).

## Checklist for manual HITL (if agent could not auto-provision)

If sandbox expires or `stripe` not installed:
1. Install CLI: `winget install Stripe.StripeCLI` or `scoop install stripe` or `npm i -g @stripe/cli`.
2. `stripe sandbox create --from-git` → note `rkcs_test_` + `pk_test_` + `claim_url`.
3. `stripe products create …` / `stripe prices create …` as above → note IDs.
4. `stripe listen --print-secret` → copy `whsec_`.
5. Copy `.env.example` → `.env`, paste keys + IDs, run `stripe login` if you prefer persistent `sk_test_` instead of `rkcs_`.

All later tickets (#10 Checkout skeleton, #11 webhook_events dedup, #16 reconciliation) read price IDs from `.env` and verify webhooks via `STRIPE_WEBHOOK_SECRET`.
