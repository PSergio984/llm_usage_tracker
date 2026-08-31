import express from 'express';
import { healthHandler } from './routes/health.js';
import { usageHandler } from './routes/usage.js';
import { generateHandler } from './routes/generate.js';
import { checkoutHandler } from './routes/checkout.js';
import { stripeWebhookHandler } from './routes/webhooks/stripe.js';
import { tenantMiddleware } from './middleware/tenant.js';
import { requireIdempotencyKey } from './middleware/idempotency.js';
import { errorHandler } from './middleware/error.js';

export function createApp() {
  const app = express();

  // Health does not need tenant or body parsing
  app.get('/health', healthHandler);

  // Stripe webhook MUST use raw body before any json parsing — isolated to that route
  app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), stripeWebhookHandler);

  // All other routes use json
  app.use(express.json());

  // Usage rollup — tenant can be header or query ?tenantId
  app.get('/usage', tenantMiddleware, usageHandler);

  // Billable endpoint — tenant + idempotency + validation inside handler
  app.post('/generate', tenantMiddleware, requireIdempotencyKey, generateHandler);

  // Checkout — creates Stripe session
  app.post('/checkout', checkoutHandler);

  // Central error handler maps AppError/ZodError → 4xx, sets Retry-After for 429, never leaks 500 stack
  app.use((err: any, req: any, res: any, next: any) => {
    if (err?.status === 429 && err?.details?.retryAfter) {
      res.setHeader('Retry-After', String(err.details.retryAfter));
    } else if (err?.status === 429 && err?.details?.retry_after) {
      res.setHeader('Retry-After', String(err.details.retry_after));
    }
    // also handle details.retryAfter nested
    if (err?.details?.retryAfter && !res.getHeader('Retry-After')) {
      res.setHeader('Retry-After', String(err.details.retryAfter));
    }
    return errorHandler(err, req, res, next);
  });

  // Fallback 404
  app.use((_req, res) => res.status(404).json({ error: 'not_found', message: 'Not found' }));

  return app;
}
