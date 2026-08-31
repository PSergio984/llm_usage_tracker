// Stub — rawBody middleware isolation
// In app.stub.ts you must mount rawBody ONLY for webhook route before json:
// app.post('/webhooks/stripe', express.raw({type: 'application/json'}), stripeWebhookHandler);
// app.use(express.json()); // for all other routes after

// If you mount express.json() globally before webhook route, you will break signature verification.
// Common mistakes: global json middleware, serverless body decoding, charset transforms.
// See docs/research/stripe-integration.md §4 diagnose order.
//
export const rawBodyIsolation = "see comment — mount express.raw on webhook route only";
