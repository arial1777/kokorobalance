import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp, makeTestUser, authHeaders, cleanupUsers } from './utils/test-app';

/** 柱の再定義と承認（07-spec-pillars.md） */
describe('Pillars (e2e)', () => {
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

  function mondayOf(date: Date): string {
    const d = new Date(date);
    const day = d.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setUTCDate(d.getUTCDate() + diff);
    return d.toISOString().split('T')[0];
  }

  // 週の境界はJST固定なので、基準日もJSTで作る（UTC基準だと 00:00〜09:00 JST でずれる）
  const currentMonday = mondayOf(
    new Date(`${new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date())}T00:00:00Z`),
  );
  function mondayWeeksAgo(weeksAgo: number): string {
    const d = new Date(`${currentMonday}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - weeksAgo * 7);
    return d.toISOString().split('T')[0];
  }

  async function setupUser(): Promise<{ id: string; email: string }> {
    const user = makeTestUser();
    createdUserIds.push(user.id);
    await request(app.getHttpServer()).get('/api/profile').set(authHeaders(user)).expect(200);
    return user;
  }

  async function createPillar(
    user: { id: string; email: string },
    name: string,
    kind: 'place' | 'relation' | 'habit',
  ): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/categories')
      .set(authHeaders(user))
      .send({ name, parentName: 'テスト', color: '#123456', kind })
      .expect(201);
    return res.body.id;
  }

  /** APIから編集できるのは今週・先週のみ（W-08）なので、それ以前の週はDBに直接入れる */
  async function seedCheck(userId: string, weeksAgo: number, categoryIds: string[]): Promise<void> {
    const [check] = await dataSource.query(
      `INSERT INTO weekly_checks (user_id, week_start) VALUES ($1, $2) RETURNING id`,
      [userId, mondayWeeksAgo(weeksAgo)],
    );
    for (const categoryId of categoryIds) {
      await dataSource.query(
        `INSERT INTO weekly_check_entries (weekly_check_id, category_id, level) VALUES ($1, $2, 2)`,
        [check.id, categoryId],
      );
    }
  }

  async function kindAndVerified(id: string): Promise<{ kind: string; verified_at: Date | null; verification_source: string | null }> {
    const [row] = await dataSource.query(
      `SELECT kind, verified_at, verification_source FROM categories WHERE id = $1`,
      [id],
    );
    return row;
  }

  it('3週連続で点検に選ばれた place は確かな柱になる（P-A-04）', async () => {
    const user = await setupUser();
    const placeId = await createPillar(user, '木曜のバンド', 'place');

    await seedCheck(user.id, 2, [placeId]);
    await request(app.getHttpServer())
      .put('/api/weekly-check')
      .set(authHeaders(user))
      .send({ weekStart: mondayWeeksAgo(1), entries: [{ categoryId: placeId, level: 2 }] })
      .expect(200);
    await request(app.getHttpServer())
      .put('/api/weekly-check')
      .set(authHeaders(user))
      .send({ weekStart: mondayWeeksAgo(0), entries: [{ categoryId: placeId, level: 3 }] })
      .expect(200);

    const row = await kindAndVerified(placeId);
    expect(row.verified_at).not.toBeNull();
    expect(row.verification_source).toBe('recurring_check');
  });

  it('habit は3週連続で選ばれても確かな柱にならない（P-A-02）', async () => {
    const user = await setupUser();
    const habitId = await createPillar(user, '朝の散歩', 'habit');

    await seedCheck(user.id, 2, [habitId]);
    for (const week of [1, 0]) {
      await request(app.getHttpServer())
        .put('/api/weekly-check')
        .set(authHeaders(user))
        .send({ weekStart: mondayWeeksAgo(week), entries: [{ categoryId: habitId, level: 2 }] })
        .expect(200);
    }

    const row = await kindAndVerified(habitId);
    expect(row.verified_at).toBeNull();

    const portfolio = await request(app.getHttpServer())
      .get('/api/portfolio?period=90')
      .set(authHeaders(user))
      .expect(200);
    expect(portfolio.body.pillars.verified).toHaveLength(0);
    expect(portfolio.body.pillars.habits).toHaveLength(1);
  });

  it('2週しか選ばれていなければ育て中のまま', async () => {
    const user = await setupUser();
    const placeId = await createPillar(user, '常連の店', 'place');

    for (const week of [1, 0]) {
      await request(app.getHttpServer())
        .put('/api/weekly-check')
        .set(authHeaders(user))
        .send({ weekStart: mondayWeeksAgo(week), entries: [{ categoryId: placeId, level: 2 }] })
        .expect(200);
    }

    const row = await kindAndVerified(placeId);
    expect(row.verified_at).toBeNull();
  });

  it('8週間まったく選ばれていない確かな柱は静かに育て中へ戻る（P-A-05）', async () => {
    const user = await setupUser();
    const staleId = await createPillar(user, '昔のサークル', 'place');
    const activeId = await createPillar(user, 'いまのチーム', 'place');

    // 9週前に承認された状態を作る（降格の窓より古い承認だけが対象）
    await dataSource.query(
      `UPDATE categories SET verified_at = now() - INTERVAL '9 weeks', verification_source = 'self_declared' WHERE id = $1`,
      [staleId],
    );

    await request(app.getHttpServer())
      .put('/api/weekly-check')
      .set(authHeaders(user))
      .send({ weekStart: mondayWeeksAgo(0), entries: [{ categoryId: activeId, level: 2 }] })
      .expect(200);

    const stale = await kindAndVerified(staleId);
    expect(stale.verified_at).toBeNull();
    expect(stale.verification_source).toBeNull();
  });

  it('直前に自己申告で承認された柱は、点検に出ていなくても即座に降格しない', async () => {
    const user = await setupUser();
    const freshId = await createPillar(user, '新しい居場所', 'place');
    const otherId = await createPillar(user, 'べつの柱', 'place');

    await request(app.getHttpServer())
      .post(`/api/categories/${freshId}/verification`)
      .set(authHeaders(user))
      .send({ answer: 'yes' })
      .expect(201);

    await request(app.getHttpServer())
      .put('/api/weekly-check')
      .set(authHeaders(user))
      .send({ weekStart: mondayWeeksAgo(0), entries: [{ categoryId: otherId, level: 2 }] })
      .expect(200);

    const fresh = await kindAndVerified(freshId);
    expect(fresh.verified_at).not.toBeNull();
    expect(fresh.verification_source).toBe('self_declared');
  });

  it('「まだかな」と答えても承認されず、聞いた時刻だけが記録される（§3.3）', async () => {
    const user = await setupUser();
    const placeId = await createPillar(user, 'まだ馴染めない場所', 'place');

    await request(app.getHttpServer())
      .post(`/api/categories/${placeId}/verification`)
      .set(authHeaders(user))
      .send({ answer: 'not_yet' })
      .expect(201);

    const [row] = await dataSource.query(
      `SELECT verified_at, verification_asked_at FROM categories WHERE id = $1`,
      [placeId],
    );
    expect(row.verified_at).toBeNull();
    expect(row.verification_asked_at).not.toBeNull();
  });

  it('習慣は承認の対象外なので自己申告できない', async () => {
    const user = await setupUser();
    const habitId = await createPillar(user, '筋トレ', 'habit');

    await request(app.getHttpServer())
      .post(`/api/categories/${habitId}/verification`)
      .set(authHeaders(user))
      .send({ answer: 'yes' })
      .expect(400);
  });

  it('型を習慣に変えると承認が外れる（不変条件）', async () => {
    const user = await setupUser();
    const placeId = await createPillar(user, '一時的な居場所', 'place');
    await request(app.getHttpServer())
      .post(`/api/categories/${placeId}/verification`)
      .set(authHeaders(user))
      .send({ answer: 'yes' })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/categories/${placeId}`)
      .set(authHeaders(user))
      .send({ kind: 'habit' })
      .expect(200);

    const row = await kindAndVerified(placeId);
    expect(row.kind).toBe('habit');
    expect(row.verified_at).toBeNull();
  });

  it('揺れの当日の支えリストに習慣も含まれる（P-A-03）', async () => {
    const user = await setupUser();
    const placeA = await createPillar(user, 'チームA', 'place');
    const placeB = await createPillar(user, 'チームB', 'place');
    const habitId = await createPillar(user, '夜の読書', 'habit');

    // 確かな柱を2件作り、支えリストの headline を 'many' にする
    await dataSource.query(
      `UPDATE categories SET verified_at = now(), verification_source = 'self_declared' WHERE id = ANY($1)`,
      [[placeA, placeB]],
    );

    const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date());
    const created = await request(app.getHttpServer())
      .post('/api/shake/events')
      .set(authHeaders(user))
      .send({ templateKey: 'exam_day', eventDate: today })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/shake/cron/tick')
      .set('Authorization', `Bearer ${process.env.CRON_SECRET}`)
      .expect(200);

    const detail = await request(app.getHttpServer())
      .get(`/api/shake/events/${created.body.event.id}`)
      .set(authHeaders(user))
      .expect(200);

    const labels = detail.body.event.supportListSnapshot.items.map((i: { label: string }) => i.label);
    expect(labels).toContain('夜の読書');
  });

  it('有効な柱は30件を超えて作れない（P-15）', async () => {
    const user = await setupUser();
    await request(app.getHttpServer())
      .post('/api/categories/bulk-create')
      .set(authHeaders(user))
      .send({
        pillars: Array.from({ length: 30 }, (_, i) => ({
          name: `柱${i}`,
          parentName: 'テスト',
          kind: 'habit',
        })),
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/categories')
      .set(authHeaders(user))
      .send({ name: '31本目', parentName: 'テスト', kind: 'habit' })
      .expect(403);
  });

  it('ラベルは20文字を超えられない（P-10）', async () => {
    const user = await setupUser();
    await request(app.getHttpServer())
      .post('/api/categories')
      .set(authHeaders(user))
      .send({ name: 'あ'.repeat(21), parentName: 'テスト', kind: 'place' })
      .expect(400);
  });

  it('他人の柱は承認も更新もできない', async () => {
    const owner = await setupUser();
    const stranger = await setupUser();
    const placeId = await createPillar(owner, '他人の居場所', 'place');

    await request(app.getHttpServer())
      .post(`/api/categories/${placeId}/verification`)
      .set(authHeaders(stranger))
      .send({ answer: 'yes' })
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/api/categories/${placeId}`)
      .set(authHeaders(stranger))
      .send({ name: '乗っ取り' })
      .expect(404);
  });
});
