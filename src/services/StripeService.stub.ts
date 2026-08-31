// Stub — StripeService mirrors Stripe truth to local subscriptions
// import { subscriptionRepo } from '../repos/subscriptionRepo.stub.js';
// import { tenantRepo } from '../repos/tenantRepo.stub.js';

export const StripeService = {
  // async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  //   // session.customer, session.subscription, session.metadata?.tenantId
  //   // Retrieve subscription if stripe hasn't yet sent .updated: const sub = await stripe.subscriptions.retrieve(session.subscription as string);
  //   // Upsert: tenant.plan_code = 'pro', subscription.status='active', current_period_start/end from sub, stripe_subscription_id = sub.id
  //   // Note: ordering caveat — .completed may arrive before .updated; fetching authoritative sub is safer (see SO 63273971)
  // },
  // async handleSubscriptionUpdated(sub: Stripe.Subscription) {
  //   // Mirror status: sub.status ('active','past_due','canceled','incomplete') → local status
  //   // If status='active' and price matches pro → tenant plan remains pro; if downgraded → maybe free
  //   // Update current_period_start/end, plan_code mapping via price lookup
  // },
  // async handleSubscriptionDeleted(sub: Stripe.Subscription) {
  //   // Mark subscription status='canceled', optionally revert tenant to free (or keep until period end per product decision)
  //   // Probe 3: after deleted, GET /usage should show free limits again
  // },
};

// Notes for real impl:
// - All handlers must be idempotent: same event replayed after dedup already ignored before reaching here,
//   but if handler retries internally (e.g., after crash), upsert should be idempotent.
// - Log at info level, never log raw body or secrets.
// - See docs/research/stripe-integration.md §3 ordering section.
