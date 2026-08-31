import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import Stripe from 'stripe';
import { createApp } from '../src/app.js';
import { pool } from '../src/db/pool.js';
import { cleanDb, createTenant } from './helpers.js';
import { env } from '../src/config/env.js';

const app = createApp();
const webhookSecret = env.STRIPE_WEBHOOK_SECRET ?? 'whsec_...redacted...';
const stripe = new Stripe(env.STRIPE_SECRET_KEY ?? 'rkcs_test_fake', { apiVersion: '2024-06-20' });

function signedHeaders(payload: string, secret = webhookSecret) {
  const header = (stripe as any).webhooks.generateTestHeaderString({ payload, secret });
  return header as string;
}

describe('Stripe webhooks — forged 400, replay ignored, Checkout flip (Probe 3/4)', () => {
  beforeAll(async () => {
    await pool.query('SELECT 1');
  });
  beforeEach(async () => {
    await cleanDb();
  });

  it('forged webhook (bad signature) → 400, nothing changes', async () => {
    const tenant = await createTenant('Forged');
    // Create a valid payload but sign with bad secret
    const payload = JSON.stringify({
      id: 'evt_forged_1',
      object: 'event',
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_forged', customer: 'cus_forged', subscription: 'sub_forged' } },
    });
    const badSig = 't=0,v1=badbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbad';
    const res = await request(app)
      .post('/webhooks/stripe')
      .set('Stripe-Signature', badSig)
      .set('Content-Type', 'application/json')
      .send(Buffer.from(payload))
      .expect(400);
    expect(res.body.error).toBe('webhook_signature_verification_failed');

    // webhook_events should still be 0, subscription not created
    const { rows: ev } = await pool.query(`SELECT COUNT(*)::int as c FROM webhook_events`);
    expect(ev[0].c).toBe(0);
    const { rows: subs } = await pool.query(`SELECT COUNT(*)::int as c FROM subscriptions`);
    expect(subs[0].c).toBe(0);
  });

  it('replay same valid event_id twice → processed once (second 200 but ignored)', async () => {
    const tenant = await createTenant('ReplayEvt');
    // Need stripe_customer_id mapping for handler to find tenant
    // For our handler, checkout.session.completed needs tenantId via client_reference_id or metadata.tenantId
    // We'll craft payload that matches handler's resolution path: use metadata.tenantId
    const eventId = 'evt_replay_123';
    const payloadObj = {
      id: eventId,
      object: 'event',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_replay',
          object: 'checkout.session',
          customer: 'cus_replay',
          subscription: 'sub_replay',
          client_reference_id: tenant.id,
          metadata: { tenantId: tenant.id },
        },
      },
    };
    const payload = JSON.stringify(payloadObj);
    const sig = signedHeaders(payload);

    const r1 = await request(app)
      .post('/webhooks/stripe')
      .set('Stripe-Signature', sig)
      .set('Content-Type', 'application/json')
      .send(payload)
      .expect(200);

    const { rows: ev1 } = await pool.query(`SELECT COUNT(*)::int as c FROM webhook_events WHERE event_id=$1`, [eventId]);
    expect(ev1[0].c).toBe(1);

    // Second replay with same id but same payload → should still be 200 but not duplicate
    const r2 = await request(app)
      .post('/webhooks/stripe')
      .set('Stripe-Signature', sig)
      .set('Content-Type', 'application/json')
      .send(payload)
      .expect(200);

    const { rows: ev2 } = await pool.query(`SELECT COUNT(*)::int as c FROM webhook_events`);
    expect(ev2[0].c).toBe(1); // not 2

    // subscription should be created once
    const { rows: subs } = await pool.query(`SELECT * FROM subscriptions WHERE stripe_subscription_id='sub_replay'`);
    expect(subs.length).toBe(1);
    expect(subs[0].plan_code).toBe('pro');
  });

  it('Checkout flip Free→Pro via checkout.session.completed → GET /usage shows new limit (Probe 3)', async () => {
    const tenant = await createTenant('CheckoutFlip');
    // Initially Free: limit 1000
    let usageBefore = await request(app).get('/usage').set('X-Tenant-Id', tenant.id).expect(200);
    expect(usageBefore.body.plan).toBe('free');
    expect(usageBefore.body.usage.apiCalls.limit).toBe(1000);

    // Simulate Stripe Checkout completed webhook with tenant mapping
    const eventId = 'evt_checkout_flip';
    const payloadObj = {
      id: eventId,
      object: 'event',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_flip',
          object: 'checkout.session',
          customer: `cus_${tenant.id}`,
          subscription: `sub_flip_${tenant.id}`,
          client_reference_id: tenant.id,
          metadata: { tenantId: tenant.id },
        },
      },
    };
    const payload = JSON.stringify(payloadObj);
    const sig = signedHeaders(payload);

    await request(app)
      .post('/webhooks/stripe')
      .set('Stripe-Signature', sig)
      .set('Content-Type', 'application/json')
      .send(payload)
      .expect(200);

    // Verify tenant stripe_customer_id set and subscription active
    const { rows: tRows } = await pool.query(`SELECT stripe_customer_id FROM tenants WHERE id=$1`, [tenant.id]);
    expect(tRows[0].stripe_customer_id).toBe(`cus_${tenant.id}`);

    const { rows: sRows } = await pool.query(`SELECT plan_code, status FROM subscriptions WHERE tenant_id=$1`, [tenant.id]);
    expect(sRows.length).toBe(1);
    expect(sRows[0].plan_code).toBe('pro');
    expect(sRows[0].status).toBe('active');

    // GET /usage should now show Pro limits 10000
    const usageAfter = await request(app).get('/usage').set('X-Tenant-Id', tenant.id).expect(200);
    expect(usageAfter.body.plan).toBe('pro');
    expect(usageAfter.body.usage.apiCalls.limit).toBe(10000);
    expect(usageAfter.body.usage.aiTokens.limit).toBe(1000000);
  });

  it('customer.subscription.updated/deleted flip plan correctly', async () => {
    const tenant = await createTenant('SubUpdate');
    const subId = `sub_upd_${tenant.id}`;
    // Seed initial pro subscription
    await pool.query(
      `INSERT INTO subscriptions (tenant_id, stripe_subscription_id, stripe_customer_id, stripe_price_id, plan_code, status)
       VALUES ($1,$2,$3,$4,'pro','active')`,
      [tenant.id, subId, `cus_${tenant.id}`, process.env.STRIPE_PRICE_PRO ?? 'price_1UAOfnRMZHQ0shBochirtXWT']
    );

    // updated -> past_due
    const updEventId = 'evt_sub_upd';
    const updPayload = JSON.stringify({
      id: updEventId,
      object: 'event',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: subId,
          object: 'subscription',
          customer: `cus_${tenant.id}`,
          status: 'past_due',
          current_period_start: Math.floor(Date.now() / 1000),
          current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
          items: { data: [{ price: { id: process.env.STRIPE_PRICE_PRO ?? 'price_1UAOfnRMZHQ0shBochirtXWT' } }] },
        },
      },
    });
    const updSig = signedHeaders(updPayload);
    await request(app)
      .post('/webhooks/stripe')
      .set('Stripe-Signature', updSig)
      .set('Content-Type', 'application/json')
      .send(updPayload)
      .expect(200);

    const { rows: afterUpd } = await pool.query(`SELECT status FROM subscriptions WHERE stripe_subscription_id=$1`, [subId]);
    expect(afterUpd[0].status).toBe('past_due');

    // deleted -> canceled
    const delEventId = 'evt_sub_del';
    const delPayload = JSON.stringify({
      id: delEventId,
      object: 'event',
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: subId,
          object: 'subscription',
          customer: `cus_${tenant.id}`,
          status: 'canceled',
          current_period_start: Math.floor(Date.now() / 1000),
          current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
          items: { data: [{ price: { id: process.env.STRIPE_PRICE_PRO ?? 'price_1UAOfnRMZHQ0shBochirtXWT' } }] },
        },
      },
    });
    const delSig = signedHeaders(delPayload);
    await request(app)
      .post('/webhooks/stripe')
      .set('Stripe-Signature', delSig)
      .set('Content-Type', 'application/json')
      .send(delPayload)
      .expect(200);

    const { rows: afterDel } = await pool.query(`SELECT status FROM subscriptions WHERE stripe_subscription_id=$1`, [subId]);
    expect(afterDel[0].status).toBe('canceled');
  });

  it('tenant isolation: usage not visible across tenants', async () => {
    const t1 = await createTenant('Iso1');
    const t2 = await createTenant('Iso2');
    await request(app).post('/generate').set('X-Tenant-Id', t1.id).set('Idempotency-Key', 'iso1-k').send({ type: 'api_call', quantity: 5 }).expect(200);
    await request(app).post('/generate').set('X-Tenant-Id', t2.id).set('Idempotency-Key', 'iso2-k').send({ type: 'api_call', quantity: 10 }).expect(200);

    const u1 = await request(app).get('/usage').set('X-Tenant-Id', t1.id).expect(200);
    const u2 = await request(app).get('/usage').set('X-Tenant-Id', t2.id).expect(200);

    expect(u1.body.usage.apiCalls.used).toBe(5);
    expect(u2.body.usage.apiCalls.used).toBe(10);
    expect(u1.body.usage.apiCalls.used).not.toBe(u2.body.usage.apiCalls.used);
  });
});
