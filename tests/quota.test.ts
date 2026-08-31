import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { pool } from '../src/db/pool.js';
import { cleanDb, createTenant, createProTenant } from './helpers.js';

const app = createApp();

describe('Quota boundary — 999/1000/1001 honest 429/402', () => {
  beforeAll(async () => {
    await pool.query('SELECT 1');
  });
  beforeEach(async () => {
    await cleanDb();
  });

  it('Free: 999 allowed, exactly 1000 allowed, 1001st → 402 payment_required with upgrade_url', async () => {
    const tenant = await createTenant('FreeQuota');

    // Fill to 999 via direct DB inserts to avoid hitting quota check overhead for 999 requests? Use MeterService via API
    // For speed, insert 999 usage_events directly with unique keys, then test via API for boundary.
    const periodStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString().slice(0, 10);
    for (let i = 0; i < 999; i++) {
      await pool.query(
        `INSERT INTO usage_events (tenant_id, type, quantity, idempotency_key, request_hash, response_status, response_body, billing_period_start)
         VALUES ($1,'api_call',1,$2,'hash','200','{}',$3::date)`,
        [tenant.id, `seed-${i}`, periodStart]
      );
    }

    // 1000th should be allowed (999+1=1000)
    const r1000 = await request(app)
      .post('/generate')
      .set('X-Tenant-Id', tenant.id)
      .set('Idempotency-Key', 'k-1000')
      .send({ type: 'api_call', quantity: 1 })
      .expect(200);
    expect(r1000.body.used).toBe(1000);

    // 1001st should be rejected 402 for Free (needs upgrade)
    const r1001 = await request(app)
      .post('/generate')
      .set('X-Tenant-Id', tenant.id)
      .set('Idempotency-Key', 'k-1001')
      .send({ type: 'api_call', quantity: 1 })
      .expect(402);

    expect(r1001.body.error).toBe('payment_required');
    expect(r1001.body.details?.upgradeUrl ?? r1001.body.upgrade_url ?? r1001.body.details?.upgrade_url).toBeDefined();
    // message should be clear
    expect(r1001.body.message).toMatch(/Free plan limit/);
  });

  it('Pro: 999 allowed, 1000 allowed, 1001st → 429 quota_exceeded with Retry-After', async () => {
    const tenant = await createProTenant('ProQuota');

    const periodStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString().slice(0, 10);
    for (let i = 0; i < 999; i++) {
      await pool.query(
        `INSERT INTO usage_events (tenant_id, type, quantity, idempotency_key, request_hash, response_status, response_body, billing_period_start)
         VALUES ($1,'api_call',1,$2,'hash','200','{}',$3::date)`,
        [tenant.id, `pro-seed-${i}`, periodStart]
      );
    }

    const r1000 = await request(app)
      .post('/generate')
      .set('X-Tenant-Id', tenant.id)
      .set('Idempotency-Key', 'pro-k-1000')
      .send({ type: 'api_call', quantity: 1 })
      .expect(200);
    expect(r1000.body.used).toBe(1000);

    // For Pro, need to fill to Pro limit 10000, but we only have 1000 so far; to test 429 we need to fill to 10000
    // Bulk insert remaining 9000 to reach 10000 (faster than loop)
    await pool.query(
      `INSERT INTO usage_events (tenant_id, type, quantity, idempotency_key, request_hash, response_status, response_body, billing_period_start)
       SELECT $1, 'api_call', 1, 'pro-seed-'||gs::text, 'hash', '200','{}',$2::date FROM generate_series(1000,9999) gs`,
      [tenant.id, periodStart]
    );

    const r10001 = await request(app)
      .post('/generate')
      .set('X-Tenant-Id', tenant.id)
      .set('Idempotency-Key', 'pro-k-10001')
      .send({ type: 'api_call', quantity: 1 })
      .expect(429);

    expect(r10001.body.error).toBe('quota_exceeded');
    expect(r10001.headers['retry-after']).toBeDefined();
    expect(r10001.body.message).toMatch(/Quota exceeded/);
  });

  it('replay with stored key bypasses quota: original 200 replay still 200 even after quota filled', async () => {
    const tenant = await createTenant('ReplayQuota');
    const key = 'replay-quota-key';
    // First request at low usage → 200 and stored
    const first = await request(app)
      .post('/generate')
      .set('X-Tenant-Id', tenant.id)
      .set('Idempotency-Key', key)
      .send({ type: 'api_call', quantity: 1 })
      .expect(200);

    // Fill to limit via direct inserts
    const periodStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString().slice(0, 10);
    for (let i = 1; i < 1000; i++) {
      await pool.query(
        `INSERT INTO usage_events (tenant_id, type, quantity, idempotency_key, request_hash, response_status, response_body, billing_period_start)
         VALUES ($1,'api_call',1,$2,'hash','200','{}',$3::date)`,
        [tenant.id, `fill-${i}`, periodStart]
      );
    }
    // Now quota is full, but replay with original key should still return original 200, not 402
    const replay = await request(app)
      .post('/generate')
      .set('X-Tenant-Id', tenant.id)
      .set('Idempotency-Key', key)
      .send({ type: 'api_call', quantity: 1 })
      .expect(200);
    expect(replay.headers['x-idempotency-replayed']).toBe('true');
    expect(replay.body.id).toBe(first.body.id);
  });

  it('GET /usage reflects used/limit/cost and period', async () => {
    const tenant = await createTenant('UsageRollup');
    await request(app).post('/generate').set('X-Tenant-Id', tenant.id).set('Idempotency-Key', 'u1').send({ type: 'api_call', quantity: 1 }).expect(200);
    await request(app)
      .post('/generate')
      .set('X-Tenant-Id', tenant.id)
      .set('Idempotency-Key', 'u2')
      .send({ type: 'ai_tokens', tokens: { input: 1500, cached_input: 500, output: 2500, reasoning: 1000 } })
      .expect(200);

    const res = await request(app).get('/usage').set('X-Tenant-Id', tenant.id).expect(200);
    expect(res.body).toHaveProperty('periodStart');
    expect(res.body).toHaveProperty('periodEnd');
    expect(res.body.usage.apiCalls.used).toBe(1);
    expect(res.body.usage.apiCalls.limit).toBe(1000);
    // token quantity is sum of tokens (1500+500+2500+1000=5500)
    expect(res.body.usage.aiTokens.used).toBe(5500);
    // cost should be 1175 micro-cents → 2 cents for the ai_tokens event (api_call cost 0)
    expect(res.body.cost.totalMicrocents).toBeGreaterThanOrEqual(1175);
  });
});
