import Stripe from 'stripe';
import { env } from '../config/env.js';
import { AppError } from './errors.js';

export function getStripe(): Stripe {
  if (!env.STRIPE_SECRET_KEY) throw new AppError(500, 'Stripe not configured');
  return new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2025-02-24.acacia' as any });
}
