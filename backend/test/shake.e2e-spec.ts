import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp, makeTestUser, authHeaders, cleanupUsers } from './utils/test-app';

describe('Shake forecast (e2e)', () => {
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

  async function firstPresetId(): Promise<string> {
    const res = await request(app.getHttpServer()).get('/api/categories/presets').expect(200);
    return res.body[0].id;
  }

  async function tick(): Promise<void> {
    await request(app.getHttpServer())
      .post('/api/shake/cron/tick')
      .set('Authorization', `Bearer ${process.env.CRON_SECRET}`)
      .expect(200);
  }

  // アプリの日付境界はJST固定なので、テスト側もJSTで基準日を作る。
  // UTC基準にすると 00:00〜09:00 JST の間だけ日付が1日ずれて「過去の日付」扱いになる
  function jstToday(): string {
    return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date());
  }

  function daysFromToday(days: number): string {
    const d = new Date(`${jstToday()}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().split('T')[0];
  }

  /** weeksAgo=0 は今週の月曜、1は先週の月曜、... */
  function mondayWeeksAgo(weeksAgo: number): string {
    const today = new Date(`${jstToday()}T00:00:00Z`);
    const day = today.getUTCDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    today.setUTCDate(today.getUTCDate() + diffToMonday - weeksAgo * 7);
    return today.toISOString().split('T')[0];
  }

  it('テンプレから登録すると3タップ相当で完了し、カテゴリ・タイトルが自動設定される', async () => {
    const user = await setupUser();
    const res = await request(app.getHttpServer())
      .post('/api/shake/events')
      .set(authHeaders(user))
      .send({ templateKey: 'oshi_graduation', eventDate: daysFromToday(30), expectedShake: 3 })
      .expect(201);

    expect(res.body.event.category).toBe('oshi');
    expect(res.body.event.title).toBe('推しの卒業・引退');
    expect(res.body.event.status).toBe('planned');
    // 安全性判定は環境のAI_STUB設定で挙動が変わりうる（分類器が非スタブの場合、感情を伴う話題を
    // cautionと判定するのは03-spec-safety.mdの「偽陽性は許容する」設計方針の範囲内）。block でないことのみ確認する
    expect(res.body.safetyVerdict).not.toBe('block');
  });

  it('過去の日付は登録できない', async () => {
    const user = await setupUser();
    await request(app.getHttpServer())
      .post('/api/shake/events')
      .set(authHeaders(user))
      .send({ templateKey: 'exam_day', eventDate: daysFromToday(-1) })
      .expect(403);
  });

  it('日付未定（is_date_certain=false）は登録でき、過去日チェックの対象外', async () => {
    const user = await setupUser();
    const res = await request(app.getHttpServer())
      .post('/api/shake/events')
      .set(authHeaders(user))
      .send({ templateKey: 'rel_breakup_risk', eventDate: daysFromToday(0), isDateCertain: false })
      .expect(201);
    expect(res.body.event.isDateCertain).toBe(false);
  });

  it('同時に有効なイベントは10件まで', async () => {
    const user = await setupUser();
    for (let i = 0; i < 10; i++) {
      await request(app.getHttpServer())
        .post('/api/shake/events')
        .set(authHeaders(user))
        .send({ templateKey: 'life_alone', eventDate: daysFromToday(60 + i) })
        .expect(201);
    }
    await request(app.getHttpServer())
      .post('/api/shake/events')
      .set(authHeaders(user))
      .send({ templateKey: 'life_alone', eventDate: daysFromToday(80) })
      .expect(403);
  });

  it('タイトルにセーフティ検知語があってもblock判定で登録は成功する', async () => {
    const user = await setupUser();
    const res = await request(app.getHttpServer())
      .post('/api/shake/events')
      .set(authHeaders(user))
      .send({ category: 'other', title: '死にたい気持ちがある', eventDate: daysFromToday(10) })
      .expect(201);
    expect(res.body.safetyVerdict).toBe('block');
    expect(res.body.hotlines.length).toBeGreaterThan(0);
  });

  it('tick()でD-14到達時にplanned→preppingへ遷移し備えが2件以上生成される（ルール由来）', async () => {
    const user = await setupUser();
    const created = await request(app.getHttpServer())
      .post('/api/shake/events')
      .set(authHeaders(user))
      .send({ templateKey: 'work_transfer', eventDate: daysFromToday(14) })
      .expect(201);
    const eventId = created.body.event.id;

    await tick();

    const detail = await request(app.getHttpServer())
      .get(`/api/shake/events/${eventId}`)
      .set(authHeaders(user))
      .expect(200);
    expect(detail.body.event.status).toBe('prepping');
    expect(detail.body.preps.length).toBeGreaterThanOrEqual(2);
    expect(detail.body.preps.every((p: { body: string }) => p.body.length <= 60)).toBe(true);
    expect(detail.body.preps.filter((p: { source: string }) => p.source === 'rule').length).toBeGreaterThanOrEqual(2);
  });

  it('備えのacceptは同時に1件までで、新たにacceptすると既存のacceptedはskippedになる', async () => {
    const user = await setupUser();
    const created = await request(app.getHttpServer())
      .post('/api/shake/events')
      .set(authHeaders(user))
      .send({ templateKey: 'work_review', eventDate: daysFromToday(14) })
      .expect(201);
    const eventId = created.body.event.id;
    await tick();

    const detail = await request(app.getHttpServer())
      .get(`/api/shake/events/${eventId}`)
      .set(authHeaders(user))
      .expect(200);
    const [first, second] = detail.body.preps;

    await request(app.getHttpServer())
      .post(`/api/shake/events/${eventId}/preps/${first.id}/accept`)
      .set(authHeaders(user))
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/shake/events/${eventId}/preps/${second.id}/accept`)
      .set(authHeaders(user))
      .expect(201);

    const after = await request(app.getHttpServer())
      .get(`/api/shake/events/${eventId}`)
      .set(authHeaders(user))
      .expect(200);
    const firstAfter = after.body.preps.find((p: { id: string }) => p.id === first.id);
    const secondAfter = after.body.preps.find((p: { id: string }) => p.id === second.id);
    expect(firstAfter.state).toBe('skipped');
    expect(secondAfter.state).toBe('accepted');
  });

  it('tick()で当日到達するとstatus=todayになり支えリストが生成され、影響カテゴリは除外される', async () => {
    const user = await setupUser();
    const presetId = await firstPresetId();
    const catRes = await request(app.getHttpServer())
      .post('/api/categories/bulk')
      .set(authHeaders(user))
      .send({ presetIds: [presetId] })
      .expect(201);
    const categoryId = catRes.body[0].id;

    // このカテゴリを直近4週の点検すべてで選び「pillar」ステージにする
    for (let week = 0; week < 4; week++) {
      const weekStart = mondayWeeksAgo(week);
      const [checkRes] = await dataSource.query(
        `INSERT INTO weekly_checks (user_id, week_start) VALUES ($1, $2) RETURNING id`,
        [user.id, weekStart],
      );
      await dataSource.query(
        `INSERT INTO weekly_check_entries (weekly_check_id, category_id, level) VALUES ($1, $2, 2)`,
        [checkRes.id, categoryId],
      );
    }

    const created = await request(app.getHttpServer())
      .post('/api/shake/events')
      .set(authHeaders(user))
      .send({ templateKey: 'exam_day', eventDate: daysFromToday(0), affectedCategoryIds: [categoryId] })
      .expect(201);
    const eventId = created.body.event.id;

    await tick();

    const detail = await request(app.getHttpServer())
      .get(`/api/shake/events/${eventId}`)
      .set(authHeaders(user))
      .expect(200);
    expect(detail.body.event.status).toBe('today');
    expect(detail.body.event.supportListSnapshot).not.toBeNull();
    const labels = detail.body.event.supportListSnapshot.items.map((i: { label: string }) => i.label);
    // 影響カテゴリ自身は「揺れている当のもの」として支えリストから除外される
    const catRow = await dataSource.query('SELECT name FROM categories WHERE id = $1', [categoryId]);
    expect(labels).not.toContain(catRow[0].name);
    expect(detail.body.hotlines.length).toBeGreaterThan(0);
  });

  it('揺れの当日はFreeユーザーでも壁打ちが日次上限を超えて使える', async () => {
    const user = await setupUser();
    await request(app.getHttpServer()).post('/api/profile/ai-consent').set(authHeaders(user)).expect(201);

    const created = await request(app.getHttpServer())
      .post('/api/shake/events')
      .set(authHeaders(user))
      .send({ templateKey: 'exam_day', eventDate: daysFromToday(0) })
      .expect(201);
    await tick();
    const detail = await request(app.getHttpServer())
      .get(`/api/shake/events/${created.body.event.id}`)
      .set(authHeaders(user))
      .expect(200);
    expect(detail.body.event.status).toBe('today');

    for (let i = 0; i < 4; i++) {
      await request(app.getHttpServer())
        .post('/api/coach/chat')
        .set(authHeaders(user))
        .send({ message: `テスト${i}` })
        .expect(201);
    }
  });

  it('ふりかえり登録でstatusが即座にarchivedになり、noteのセーフティ検知でも保存は成功する', async () => {
    const user = await setupUser();
    const created = await request(app.getHttpServer())
      .post('/api/shake/events')
      .set(authHeaders(user))
      .send({ templateKey: 'exam_day', eventDate: daysFromToday(0) })
      .expect(201);
    const eventId = created.body.event.id;
    await tick();

    const res = await request(app.getHttpServer())
      .post(`/api/shake/events/${eventId}/review`)
      .set(authHeaders(user))
      .send({ feltShake: 2, wasSupported: 'partly', note: '消えてしまいたいと思った' })
      .expect(201);
    expect(res.body.safetyVerdict).toBe('block');
    expect(res.body.hotlines.length).toBeGreaterThan(0);

    const detail = await request(app.getHttpServer())
      .get(`/api/shake/events/${eventId}`)
      .set(authHeaders(user))
      .expect(200);
    expect(detail.body.event.status).toBe('archived');
    expect(detail.body.review.wasSupported).toBe('partly');
  });

  it('同じ揺れそうな日に2回ふりかえりは登録できない', async () => {
    const user = await setupUser();
    const created = await request(app.getHttpServer())
      .post('/api/shake/events')
      .set(authHeaders(user))
      .send({ templateKey: 'exam_day', eventDate: daysFromToday(0) })
      .expect(201);
    const eventId = created.body.event.id;

    await request(app.getHttpServer())
      .post(`/api/shake/events/${eventId}/review`)
      .set(authHeaders(user))
      .send({ feltShake: 1, wasSupported: 'yes' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/shake/events/${eventId}/review`)
      .set(authHeaders(user))
      .send({ feltShake: 1, wasSupported: 'yes' })
      .expect(403);
  });
});
