import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp, makeTestUser, authHeaders, cleanupUsers } from './utils/test-app';

describe('Account deletion (e2e)', () => {
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

  it('プロフィール・カテゴリ・記録がまとめて削除される', async () => {
    const user = makeTestUser();
    createdUserIds.push(user.id);

    await request(app.getHttpServer())
      .get('/api/profile')
      .set(authHeaders(user))
      .expect(200);

    const presetsRes = await request(app.getHttpServer()).get('/api/categories/presets').expect(200);
    const categoryRes = await request(app.getHttpServer())
      .post('/api/categories/bulk')
      .set(authHeaders(user))
      .send({ presetIds: [presetsRes.body[0].id] })
      .expect(201);
    const categoryId = categoryRes.body[0].id;

    await request(app.getHttpServer())
      .post('/api/records')
      .set(authHeaders(user))
      .send({ recordedDate: '2026-01-01', items: [{ categoryId, score: 2 }] })
      .expect(201);

    await request(app.getHttpServer())
      .delete('/api/profile')
      .set(authHeaders(user))
      .expect(204);

    const profileRows = await dataSource.query('SELECT 1 FROM profiles WHERE id = $1', [user.id]);
    const categoryRows = await dataSource.query('SELECT 1 FROM categories WHERE user_id = $1', [user.id]);
    const recordRows = await dataSource.query('SELECT 1 FROM daily_records WHERE user_id = $1', [user.id]);
    expect(profileRows).toHaveLength(0);
    expect(categoryRows).toHaveLength(0);
    expect(recordRows).toHaveLength(0);
  });

  it('Stripeの購読レコードが残っていても削除処理は失敗しない（解約試行がエラーでもブロックしない）', async () => {
    const user = makeTestUser();
    createdUserIds.push(user.id);

    await request(app.getHttpServer())
      .get('/api/profile')
      .set(authHeaders(user))
      .expect(200);

    // 実際のStripeには存在しないダミーの購読レコード（解約APIは失敗するはずだが、削除全体は成功する必要がある）
    await dataSource.query(
      `INSERT INTO subscriptions (user_id, stripe_customer_id, stripe_subscription_id, status, plan)
       VALUES ($1, 'cus_test_dummy', $2, 'active', 'pro')`,
      [user.id, `sub_test_dummy_${user.id}`],
    );

    await request(app.getHttpServer())
      .delete('/api/profile')
      .set(authHeaders(user))
      .expect(204);

    const profileRows = await dataSource.query('SELECT 1 FROM profiles WHERE id = $1', [user.id]);
    expect(profileRows).toHaveLength(0);
  });

  it('RevenueCat(iOS)の購読レコードが残っていても削除処理は失敗しない（Apple側は解約APIを持たないため対象外）', async () => {
    const user = makeTestUser();
    createdUserIds.push(user.id);

    await request(app.getHttpServer())
      .get('/api/profile')
      .set(authHeaders(user))
      .expect(200);

    await dataSource.query(
      `INSERT INTO subscriptions (user_id, provider, revenuecat_original_transaction_id, status, plan)
       VALUES ($1, 'revenuecat', $2, 'active', 'pro')`,
      [user.id, `txn_test_dummy_${user.id}`],
    );

    await request(app.getHttpServer())
      .delete('/api/profile')
      .set(authHeaders(user))
      .expect(204);

    const profileRows = await dataSource.query('SELECT 1 FROM profiles WHERE id = $1', [user.id]);
    expect(profileRows).toHaveLength(0);
  });
});
