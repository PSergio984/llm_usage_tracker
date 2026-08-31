import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import Stripe from 'stripe';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

const CheckoutSchema = z.object({
  tenantId: z.string().uuid(),
  plan: z.enum(['pro']),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

function getStripe(): Stripe {
  if (!env.STRIPE_SECRET_KEY) throw new AppError(500, 'Stripe not configured');
  return new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2025-02-24.acacia' as any });
}

export async function checkoutHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = CheckoutSchema.safeParse(req.body);
    if (!parsed.success) throw parsed.error;
    const { tenantId, plan, successUrl, cancelUrl } = parsed.data;
    if (plan !== 'pro') throw new AppError(400, 'Only pro upgrade supported');

    const priceId = env.STRIPE_PRICE_PRO;
    if (!priceId) throw new AppError(500, 'STRIPE_PRICE_PRO not configured');

    const stripe = getStripe();

    // Ensure tenant exists; stripe customer will be created lazily via tenantRepo if needed
    // For core, assume tenant already has stripe_customer_id or let Checkout create customer
    const appUrl = `http://localhost:${env.PORT}`;
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl ?? `${appUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl ?? `${appUrl}/cancel`,
      client_reference_id: tenantId,
      metadata: { tenantId },
      subscription_data: { metadata: { tenantId } },
    });

    if (!session.url) throw new AppError(500, 'Checkout session missing url');
    // 303 per Stripe docs
    res.status(200).json({ url: session.url, sessionId: session.id });
  } catch (err) {
    next(err);
  }
}
