// Stub — POST /webhooks/stripe verified, deduplicated, plan/status mirror
// CRITICAL: This route MUST use express.raw({type:'application/json'}) before any express.json() middleware.
// Any body manipulation before verify causes signature mismatch (docs/research/stripe-integration.md).
import type { Request, Response } from 'express';
// import Stripe from 'stripe';
// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' });
// import { webhookEventRepo } from '../../repos/webhookEventRepo.stub.js';
// import { StripeService } from '../../services/StripeService.stub.js';

export async function stripeWebhookHandler(req: Request, res: Response) {
  // const sig = req.headers['stripe-signature'] as string | undefined;
  // const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;
  // let event: Stripe.Event;
  // try {
  //   // req.body is Buffer when using express.raw — stripe.webhooks.constructEvent needs raw bytes
  //   event = stripe.webhooks.constructEvent(req.body, sig!, endpointSecret);
  // } catch (err: any) {
  //   console.log('⚠️  Webhook signature verification failed.', err.message);
  //   return res.sendStatus(400); // Probe 4: forged → 400, nothing changes
  // }

  // // Deduplicate: replayed event with same id must be ignored (Probe 4 second half)
  // const inserted = await webhookEventRepo.tryInsert(event.id, event.type, event);
  // if (!inserted) {
  //   // ON CONFLICT DO NOTHING returned 0 rows → already processed
  //   return res.sendStatus(200);
  // }

  // // Handle the three core events (capstone §4)
  // switch (event.type) {
  //   case 'checkout.session.completed': {
  //     // event.data.object is Session; may need to fetch subscription if you need full object
  //     // const session = event.data.object as Stripe.Checkout.Session;
  //     // await StripeService.handleCheckoutCompleted(session);
  //     break;
  //   }
  //   case 'customer.subscription.updated': {
  //     // const sub = event.data.object as Stripe.Subscription;
  //     // await StripeService.handleSubscriptionUpdated(sub);
  //     break;
  //   }
  //   case 'customer.subscription.deleted': {
  //     // const sub = event.data.object as Stripe.Subscription;
  //     // await StripeService.handleSubscriptionDeleted(sub);
  //     break;
  //   }
  //   default:
  //     // ignore other events
  //     break;
  // }

  // res.sendStatus(200);
  res.status(200).json({ stub: 'stripe webhook stub — verify raw body → 400 on forged, dedup via webhook_events PK, mirror plan/status' });
}
