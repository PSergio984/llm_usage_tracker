// Stub — POST /checkout creates Stripe Checkout Session for Pro (mode:'subscription')
// Reuses STRIPE_PRICE_PRO from .env provisioned in docs/STRIPE.md
import type { Request, Response, NextFunction } from 'express';
// import Stripe from 'stripe';
// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' });

export async function checkoutHandler(req: Request, res: Response, next: NextFunction) {
  try {
    // // 1. Validate tenant + plan (only pro upgrade in core)
    // const { tenantId, plan } = req.body; // plan: 'pro'
    // if (!tenantId || plan !== 'pro') return res.status(400).json({ error: 'invalid_plan' });
    // // 2. Ensure tenant has stripe_customer_id (create customer if absent)
    // // let customerId = await tenantRepo.getStripeCustomerId(tenantId);
    // // if (!customerId) {
    // //   const customer = await stripe.customers.create({ metadata: { tenantId } });
    // //   await tenantRepo.setStripeCustomerId(tenantId, customer.id);
    // //   customerId = customer.id;
    // // }
    // // 3. Create Checkout Session — sensitive price stays on server, client only picks plan
    // const session = await stripe.checkout.sessions.create({
    //   mode: 'subscription',
    //   customer: customerId,
    //   line_items: [{ price: process.env.STRIPE_PRICE_PRO!, quantity: 1 }],
    //   success_url: `${process.env.APP_URL ?? 'http://localhost:3000'}/success?session_id={CHECKOUT_SESSION_ID}`,
    //   cancel_url: `${process.env.APP_URL ?? 'http://localhost:3000'}/cancel`,
    //   // subscription_data: { metadata: { tenantId } } // optional passthrough
    // });
    // // 4. Return url for client redirect (303); don't expose secret
    // return res.status(200).json({ url: session.url, sessionId: session.id });
    res.status(200).json({ stub: 'checkout stub — create Session with STRIPE_PRICE_PRO and return url' });
  } catch (err) { next(err); }
}
