// Stub — Express app shape to react to (not production)
// Run: npm run dev after copying to src/app.ts and installing deps
import express from 'express';
// import { errorHandler } from './middleware/error.stub.js';

export function createApp() {
  const app = express();

  // Health does not need body parsing
  // app.get('/health', healthHandler);

  // Stripe webhook MUST use raw body before json — isolated to that route
  // app.post('/webhooks/stripe', express.raw({type: 'application/json'}), webhookHandler);

  // All other routes use json + validation
  // app.use(express.json());
  // app.use(tenantMiddleware); // X-Tenant-Id → req.tenantId, 400 if missing/invalid

  // Billable + read paths
  // app.post('/generate', validateGenerate, generateHandler);
  // app.get('/usage', validateUsage, usageHandler);
  // app.post('/checkout', checkoutHandler);

  // Central error maps AppError(status) → 4xx, else 500 (never leak stack)
  // app.use(errorHandler);

  return app;
}

// TODO when graduating: choose PORT from env, listen, and add `capstone.yaml` run: `npm run dev`
