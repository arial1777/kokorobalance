import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp, makeTestUser, authHeaders, cleanupUsers } from './utils/test-app';

const AUTH_TOKEN = process.env.REVENUECAT_WEBHOOK_AUTH_TOKEN ?? '';

describe('RevenueCat Webhook (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    ({ app, dataSource } = await createTestApp());
  });

  afterAll(async () => {
    await cleanupUsers(dataSource, createdUserIds);
    await app.close();
  });

  it('Authorizationヘッダーが不正なら401で拒否される', async () => {
    const user = makeTestUser();
    createdUserIds.push(user.id);

    await request(app.getHttpServer())
      .post('/api/payments/revenuecat-webhook')
      .set('authorization', 'Bearer wrong-token')
      .send({
        event: {
          id: 'evt_1',
          type: 'INITIAL_PURCHASE',
          app_user_id: user.id,
          entitlement_ids: ['pro'],
          original_transaction_id: `txn_${user.id}`,
        },
      })
      .expect(401);

    const profileRows = await dataSource.query('SELECT plan FROM profiles WHERE id = $1', [user.id]);
    expect(profileRows).toHaveLength(0);
  });

  it('INITIAL_PURCHASEでplanがproになり、subscriptionsにrevenuecat行が作られる', async () => {
    const user = makeTestUser();
    createdUserIds.push(user.id);

    // profileを先に作成しておく（createTestAppはSupabaseAuthGuardをFakeAuthGuardに差し替え済み）
    await request(app.getHttpServer())
      .get('/api/profile')
      .set(authHeaders(user))
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/payments/revenuecat-webhook')
      .set('authorization', AUTH_TOKEN)
      .send({
        event: {
          id: 'evt_2',
          type: 'INITIAL_PURCHASE',
          app_user_id: user.id,
          product_id: 'com.kokorobalance.app.pro.monthly',
          entitlement_ids: ['pro'],
          period_type: 'NORMAL',
          purchased_at_ms: Date.now(),
          expiration_at_ms: Date.now() + 30 * 24 * 60 * 60 * 1000,
          original_transaction_id: `txn_${user.id}`,
        },
      })
      .expect(201);

    const profileRows = await dataSource.query('SELECT plan FROM profiles WHERE id = $1', [user.id]);
    expect(profileRows[0].plan).toBe('pro');

    const subRows = await dataSource.query(
      'SELECT provider, status, revenuecat_product_id FROM subscriptions WHERE user_id = $1',
      [user.id],
    );
    expect(subRows).toHaveLength(1);
    expect(subRows[0].provider).toBe('revenuecat');
    expect(subRows[0].status).toBe('active');
    expect(subRows[0].revenuecat_product_id).toBe('com.kokorobalance.app.pro.monthly');
  });

  it('EXPIRATIONでplanがfreeに戻る', async () => {
    const user = makeTestUser();
    createdUserIds.push(user.id);
    const originalTransactionId = `txn_${user.id}`;

    await request(app.getHttpServer()).get('/api/profile').set(authHeaders(user)).expect(200);

    await request(app.getHttpServer())
      .post('/api/payments/revenuecat-webhook')
      .set('authorization', AUTH_TOKEN)
      .send({
        event: {
          id: 'evt_3',
          type: 'INITIAL_PURCHASE',
          app_user_id: user.id,
          entitlement_ids: ['pro'],
          original_transaction_id: originalTransactionId,
        },
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/payments/revenuecat-webhook')
      .set('authorization', AUTH_TOKEN)
      .send({
        event: {
          id: 'evt_4',
          type: 'EXPIRATION',
          app_user_id: user.id,
          entitlement_ids: ['pro'],
          original_transaction_id: originalTransactionId,
        },
      })
      .expect(201);

    const profileRows = await dataSource.query('SELECT plan FROM profiles WHERE id = $1', [user.id]);
    expect(profileRows[0].plan).toBe('free');

    const subRows = await dataSource.query('SELECT status FROM subscriptions WHERE user_id = $1', [user.id]);
    expect(subRows[0].status).toBe('canceled');
  });

  it('REFUNDでもplanがfreeに戻り、subscriptionsがcanceledになる（返金ユーザーがProのまま残らない）', async () => {
    const user = makeTestUser();
    createdUserIds.push(user.id);
    const originalTransactionId = `txn_${user.id}`;

    await request(app.getHttpServer()).get('/api/profile').set(authHeaders(user)).expect(200);

    await request(app.getHttpServer())
      .post('/api/payments/revenuecat-webhook')
      .set('authorization', AUTH_TOKEN)
      .send({
        event: {
          id: 'evt_5',
          type: 'INITIAL_PURCHASE',
          app_user_id: user.id,
          entitlement_ids: ['pro'],
          original_transaction_id: originalTransactionId,
        },
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/payments/revenuecat-webhook')
      .set('authorization', AUTH_TOKEN)
      .send({
        event: {
          id: 'evt_6',
          type: 'REFUND',
          app_user_id: user.id,
          entitlement_ids: ['pro'],
          original_transaction_id: originalTransactionId,
        },
      })
      .expect(201);

    const profileRows = await dataSource.query('SELECT plan FROM profiles WHERE id = $1', [user.id]);
    expect(profileRows[0].plan).toBe('free');

    const subRows = await dataSource.query('SELECT status FROM subscriptions WHERE user_id = $1', [user.id]);
    expect(subRows).toHaveLength(1);
    expect(subRows[0].status).toBe('canceled');
  });

  it('original_transaction_idが無いイベントが複数回届いても、subscriptionsに重複行を作らない', async () => {
    const user = makeTestUser();
    createdUserIds.push(user.id);

    await request(app.getHttpServer()).get('/api/profile').set(authHeaders(user)).expect(200);

    for (const id of ['evt_7', 'evt_8']) {
      await request(app.getHttpServer())
        .post('/api/payments/revenuecat-webhook')
        .set('authorization', AUTH_TOKEN)
        .send({
          event: {
            id,
            type: 'INITIAL_PURCHASE',
            app_user_id: user.id,
            entitlement_ids: ['pro'],
          },
        })
        .expect(201);
    }

    const subRows = await dataSource.query(
      'SELECT status FROM subscriptions WHERE user_id = $1 AND provider = $2',
      [user.id, 'revenuecat'],
    );
    expect(subRows).toHaveLength(1);
  });
});
