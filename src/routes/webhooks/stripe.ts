import type { Request, Response } from 'express';
import Stripe from 'stripe';
import { env } from '../../config/env.js';
import { webhookEventRepo } from '../../repos/webhookEventRepo.js';
import { StripeService } from '../../services/StripeService.js';

function getStripe(): Stripe {
  if (!env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY not configured');
  return new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2025-02-24.acacia' as any });
}

export async function stripeWebhookHandler(req: Request, res: Response) {
  const sig = req.headers['stripe-signature'] as string | undefined;
  const secret = env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[webhook] missing STRIPE_WEBHOOK_SECRET');
    return res.sendStatus(500);
  }
  if (!sig) return res.status(400).json({ error: 'missing_signature' });

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    // req.body is Buffer when using express.raw
    const raw = req.body as Buffer;
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (err: any) {
    console.log('⚠️  Webhook signature verification failed.', err.message);
    return res.status(400).json({ error: 'webhook_signature_verification_failed', message: err.message });
  }

  // Deduplicate: replayed event with same id must be ignored (Probe 4)
  const inserted = await webhookEventRepo.tryInsert(event.id, event.type, event);
  if (!inserted) {
    return res.sendStatus(200);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any;
        await StripeService.handleCheckoutCompleted(session);
        break;
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object as any;
        await StripeService.handleSubscriptionUpdated(sub);
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as any;
        await StripeService.handleSubscriptionDeleted(sub);
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error('[webhook] handler error', err);
    // still return 200 to avoid Stripe retries storm; log for reconciliation
  }

  return res.sendStatus(200);
}
