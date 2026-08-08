import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp, makeTestUser, authHeaders, cleanupUsers } from './utils/test-app';

/** 課金設計（10-pricing-b2b.md）と計測設計（11-metrics.md）の受入基準 */
describe('Pricing & metrics (e2e)', () => {
  jest.setTimeout(60000);
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

  async function setupUser(): Promise<{ id: string; email: string }> {
    const user = makeTestUser();
    createdUserIds.push(user.id);
    await request(app.getHttpServer()).get('/api/profile').set(authHeaders(user)).expect(200);
    return user;
  }

  function todayJST(): string {
    return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date());
  }

  it('購入できるプランを返し、年額が設定されていれば既定になる（M-A-01）', async () => {
    const res = await request(app.getHttpServer()).get('/api/payments/plans').expect(200);
    expect(Array.isArray(res.body.intervals)).toBe(true);
    // 年額Priceが設定されているときは必ず先頭かつ既定（年額主導線）
    if (res.body.intervals.includes('annual')) {
      expect(res.body.intervals[0]).toBe('annual');
      expect(res.body.defaultInterval).toBe('annual');
    }
  });

  it('未設定のプランでのチェックアウトは400になる（価格を取り違えて課金しない）', async () => {
    const user = await setupUser();
    const plans = await request(app.getHttpServer()).get('/api/payments/plans').expect(200);
    const unavailable = (['annual', 'month'] as const).find((i) => !plans.body.intervals.includes(i));
    if (!unavailable) return; // 両方設定済みの環境ではスキップ

    await request(app.getHttpServer())
      .post('/api/payments/create-checkout')
      .set(authHeaders(user))
      .send({ interval: unavailable })
      .expect(400);
  });

  it('不正な interval は弾かれる', async () => {
    const user = await setupUser();
    await request(app.getHttpServer())
      .post('/api/payments/create-checkout')
      .set(authHeaders(user))
      .send({ interval: 'weekly' })
      .expect(400);
  });

  // M-A-06 の回帰。Free で揺れ予報が全機能使えることを守る
  it('Freeユーザーが揺れ予報の登録・備え・ふりかえりを使える（M-A-06）', async () => {
    const user = await setupUser();
    const [profile] = await dataSource.query('SELECT plan FROM profiles WHERE id = $1', [user.id]);
    expect(profile.plan).toBe('free');

    const created = await request(app.getHttpServer())
      .post('/api/shake/events')
      .set(authHeaders(user))
      .send({ templateKey: 'exam_day', eventDate: todayJST() })
      .expect(201);
    const eventId = created.body.event.id;

    await request(app.getHttpServer())
      .post('/api/shake/events/' + eventId + '/preps')
      .set(authHeaders(user))
      .send({ body: '当日の予定を空けておく' })
      .expect(201);

    // ふりかえりまで到達できる（passedへ落としてから）
    await dataSource.query("UPDATE shake_events SET status = 'passed' WHERE id = $1", [eventId]);
    await request(app.getHttpServer())
      .post('/api/shake/events/' + eventId + '/review')
      .set(authHeaders(user))
      .send({ feltShake: 2, wasSupported: 'yes' })
      .expect(201);
  });

  it('北極星指標の元データがイベントとして記録される（11 §2）', async () => {
    const user = await setupUser();
    const created = await request(app.getHttpServer())
      .post('/api/shake/events')
      .set(authHeaders(user))
      .send({ templateKey: 'exam_day', eventDate: todayJST() })
      .expect(201);
    await dataSource.query("UPDATE shake_events SET status = 'passed' WHERE id = $1", [created.body.event.id]);
    await request(app.getHttpServer())
      .post('/api/shake/events/' + created.body.event.id + '/review')
      .set(authHeaders(user))
      .send({ feltShake: 3, wasSupported: 'partly', note: 'これは記録されてはいけないメモ' })
      .expect(201);

    const [row] = await dataSource.query(
      `SELECT properties FROM event_logs WHERE user_id = $1 AND event_name = 'shake_review_submitted'`,
      [user.id],
    );
    expect(row.properties.wasSupported).toBe('partly');
    // ME-01: メモは分析基盤に流れない
    expect(JSON.stringify(row.properties)).not.toContain('記録されてはいけない');
  });

  it('柱の追加イベントにラベルが含まれない（ME-02）', async () => {
    const user = await setupUser();
    await request(app.getHttpServer())
      .post('/api/categories')
      .set(authHeaders(user))
      .send({ name: 'ひみつの居場所', parentName: 'テスト', kind: 'place' })
      .expect(201);

    const [row] = await dataSource.query(
      `SELECT properties FROM event_logs WHERE user_id = $1 AND event_name = 'pillar_added'`,
      [user.id],
    );
    expect(row.properties).toEqual({ kind: 'place' });
    expect(JSON.stringify(row.properties)).not.toContain('ひみつの居場所');
  });

  it('分析をオプトアウトするとイベントが記録されなくなる（ME-05）', async () => {
    const user = await setupUser();
    await request(app.getHttpServer())
      .patch('/api/profile')
      .set(authHeaders(user))
      .send({ analyticsOptOut: true })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/categories')
      .set(authHeaders(user))
      .send({ name: '記録されない柱', parentName: 'テスト', kind: 'place' })
      .expect(201);

    const rows = await dataSource.query(
      `SELECT id FROM event_logs WHERE user_id = $1 AND event_name = 'pillar_added'`,
      [user.id],
    );
    expect(rows).toHaveLength(0);
  });

  it('オプトアウトしてもセーフティの検知は止まらない（03 §6.3）', async () => {
    const user = await setupUser();
    await request(app.getHttpServer())
      .patch('/api/profile')
      .set(authHeaders(user))
      .send({ analyticsOptOut: true })
      .expect(200);

    const res = await request(app.getHttpServer())
      .put('/api/weekly-check')
      .set(authHeaders(user))
      .send({ entries: [], moodNote: '死にたい気持ちがある' })
      .expect(200);

    expect(res.body.safetyVerdict).toBe('block');
    expect(res.body.hotlines.length).toBeGreaterThan(0);
    const safety = await dataSource.query('SELECT id FROM safety_events WHERE user_id = $1', [user.id]);
    expect(safety.length).toBeGreaterThan(0);
  });
});
