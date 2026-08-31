import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { pool } from '../src/db/pool.js';
import { cleanDb, createTenant, countEvents } from './helpers.js';

const app = createApp();

describe('Metering idempotency — same key = one event (Probe 1)', () => {
  beforeAll(async () => {
    // ensure DB up
    await pool.query('SELECT 1');
  });
  // keep pool open for other test files (singleFork sequential)
  beforeEach(async () => {
    await cleanDb();
  });

  it('double-send same Idempotency-Key with same payload → one row, second mirrors first', async () => {
    const tenant = await createTenant();
    const key = 'idem-123';
    const payload = { type: 'api_call', quantity: 1 };

    const first = await request(app)
      .post('/generate')
      .set('X-Tenant-Id', tenant.id)
      .set('Idempotency-Key', key)
      .send(payload)
      .expect(200);

    expect(first.body).toHaveProperty('id');
    expect(first.headers['x-idempotency-replayed']).toBeUndefined();
    expect(await countEvents(tenant.id)).toBe(1);

    const second = await request(app)
      .post('/generate')
      .set('X-Tenant-Id', tenant.id)
      .set('Idempotency-Key', key)
      .send(payload)
      .expect(200);

    expect(second.body.id).toBe(first.body.id);
    expect(second.headers['x-idempotency-replayed']).toBe('true');
    expect(await countEvents(tenant.id)).toBe(1);
    expect(second.body).toEqual(first.body);
  });

  it('same key with different payload → 422 idempotency_key_reused', async () => {
    const tenant = await createTenant();
    const key = 'idem-diff';
    await request(app)
      .post('/generate')
      .set('X-Tenant-Id', tenant.id)
      .set('Idempotency-Key', key)
      .send({ type: 'api_call', quantity: 1 })
      .expect(200);

    const res = await request(app)
      .post('/generate')
      .set('X-Tenant-Id', tenant.id)
      .set('Idempotency-Key', key)
      .send({ type: 'api_call', quantity: 2 })
      .expect(422);

    expect(res.body.error).toBe('idempotency_key_reused');
    expect(await countEvents(tenant.id)).toBe(1);
  });

  it('concurrent double-send same key → exactly one row via ON CONFLICT', async () => {
    const tenant = await createTenant();
    const key = 'idem-race';
    const payload = { type: 'api_call', quantity: 1 };

    const [a, b] = await Promise.all([
      request(app).post('/generate').set('X-Tenant-Id', tenant.id).set('Idempotency-Key', key).send(payload),
      request(app).post('/generate').set('X-Tenant-Id', tenant.id).set('Idempotency-Key', key).send(payload),
    ]);

    // one should be 200, the other may be 200 replay or 429/500 but row count must be 1
    expect([a.status, b.status].sort()).toEqual([200, 200]);
    expect(await countEvents(tenant.id)).toBe(1);
    // at least one has replay header
    const hasReplay = !!(a.headers['x-idempotency-replayed'] || b.headers['x-idempotency-replayed']);
    // Depending on timing, second may be replay; if both hit insert simultaneously, one will be replay
    // We assert at least bodies match or one is replay
    if (a.body.id && b.body.id) {
      expect(a.body.id === b.body.id || hasReplay).toBe(true);
    }
  });

  it('missing Idempotency-Key → 400', async () => {
    const tenant = await createTenant();
    await request(app).post('/generate').set('X-Tenant-Id', tenant.id).send({ type: 'api_call', quantity: 1 }).expect(400);
  });

  it('different tenant same key → separate rows (per-tenant scope)', async () => {
    const t1 = await createTenant('T1');
    const t2 = await createTenant('T2');
    const key = 'shared-key';
    const payload = { type: 'api_call', quantity: 1 };
    const r1 = await request(app).post('/generate').set('X-Tenant-Id', t1.id).set('Idempotency-Key', key).send(payload).expect(200);
    const r2 = await request(app).post('/generate').set('X-Tenant-Id', t2.id).set('Idempotency-Key', key).send(payload).expect(200);
    expect(r1.body.id).not.toBe(r2.body.id);
    expect(await countEvents(t1.id)).toBe(1);
    expect(await countEvents(t2.id)).toBe(1);
  });
});
