import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp, makeTestUser, authHeaders, cleanupUsers } from './utils/test-app';

describe('Weekly check (e2e)', () => {
  jest.setTimeout(30000);
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

  async function setupUserWithCategory(): Promise<{ user: { id: string; email: string }; categoryId: string }> {
    const user = makeTestUser();
    createdUserIds.push(user.id);
    await request(app.getHttpServer()).get('/api/profile').set(authHeaders(user)).expect(200);

    const presets = await request(app.getHttpServer()).get('/api/categories/presets').expect(200);
    const presetId = presets.body[0].id;
    const cats = await request(app.getHttpServer())
      .post('/api/categories/bulk')
      .set(authHeaders(user))
      .send({ presetIds: [presetId] })
      .expect(201);
    return { user, categoryId: cats.body[0].id };
  }

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

  it('0件選択でも保存でき、失敗として扱われない', async () => {
    const { user } = await setupUserWithCategory();
    const res = await request(app.getHttpServer())
      .put('/api/weekly-check')
      .set(authHeaders(user))
      .send({ entries: [] })
      .expect(200);

    expect(res.body.check.weekStart).toBe(currentMonday);
    expect(res.body.safetyVerdict).toBe('clear');

    const rows = await dataSource.query(
      `SELECT * FROM weekly_check_entries wce
       JOIN weekly_checks wc ON wc.id = wce.weekly_check_id
       WHERE wc.user_id = $1`,
      [user.id],
    );
    expect(rows).toHaveLength(0);
  });

  it('カテゴリを選択して保存すると、そのentryが記録される', async () => {
    const { user, categoryId } = await setupUserWithCategory();
    const res = await request(app.getHttpServer())
      .put('/api/weekly-check')
      .set(authHeaders(user))
      .send({ entries: [{ categoryId, level: 3 }] })
      .expect(200);

    expect(res.body.check.entries).toHaveLength(1);
    expect(res.body.check.entries[0]).toMatchObject({ categoryId, level: 3 });
  });

  it('同一週への再保存は上書きされる（前回のentriesは消える）', async () => {
    const { user, categoryId } = await setupUserWithCategory();
    await request(app.getHttpServer())
      .put('/api/weekly-check')
      .set(authHeaders(user))
      .send({ entries: [{ categoryId, level: 1 }] })
      .expect(200);

    const second = await request(app.getHttpServer())
      .put('/api/weekly-check')
      .set(authHeaders(user))
      .send({ entries: [] })
      .expect(200);

    expect(second.body.check.entries).toHaveLength(0);
  });

  it('先週分は保存できるが、2週前は拒否される', async () => {
    const { user, categoryId } = await setupUserWithCategory();
    await request(app.getHttpServer())
      .put('/api/weekly-check')
      .set(authHeaders(user))
      .send({ weekStart: mondayWeeksAgo(1), entries: [{ categoryId, level: 2 }] })
      .expect(200);

    await request(app.getHttpServer())
      .put('/api/weekly-check')
      .set(authHeaders(user))
      .send({ weekStart: mondayWeeksAgo(2), entries: [{ categoryId, level: 2 }] })
      .expect(403);
  });

  it('他ユーザーのカテゴリIDは指定できない（IDOR対策）', async () => {
    const { categoryId: victimCategoryId } = await setupUserWithCategory();
    const { user: attacker } = await setupUserWithCategory();

    await request(app.getHttpServer())
      .put('/api/weekly-check')
      .set(authHeaders(attacker))
      .send({ entries: [{ categoryId: victimCategoryId, level: 1 }] })
      .expect(403);
  });

  it('点検完了で「今週のまとめ」が自動生成される（手動生成不要）', async () => {
    const { user, categoryId } = await setupUserWithCategory();
    await request(app.getHttpServer())
      .put('/api/weekly-check')
      .set(authHeaders(user))
      .send({ entries: [{ categoryId, level: 2 }] })
      .expect(200);

    const report = await request(app.getHttpServer())
      .get(`/api/reports/${currentMonday}`)
      .set(authHeaders(user))
      .expect(200);
    expect(report.body).not.toBeNull();
    expect(report.body.weekStartDate).toBe(currentMonday);
  });

  it('0件選択の点検でも「今週のまとめ」が生成される（原則4: 空の状態を作らない）', async () => {
    const { user } = await setupUserWithCategory();
    await request(app.getHttpServer())
      .put('/api/weekly-check')
      .set(authHeaders(user))
      .send({ entries: [] })
      .expect(200);

    const report = await request(app.getHttpServer())
      .get(`/api/reports/${currentMonday}`)
      .set(authHeaders(user))
      .expect(200);
    expect(report.body).not.toBeNull();
  });

  it('mood_noteにセーフティ検知語があってもblock判定で保存は成功する', async () => {
    const { user } = await setupUserWithCategory();
    const res = await request(app.getHttpServer())
      .put('/api/weekly-check')
      .set(authHeaders(user))
      .send({ entries: [], moodNote: '死にたい気持ちがある' })
      .expect(200);

    expect(res.body.safetyVerdict).toBe('block');
    expect(res.body.hotlines.length).toBeGreaterThan(0);
    expect(res.body.check.moodNote).toBe('死にたい気持ちがある');
  });

  it('3週連続で選ばれた relation の柱が確かな柱になり、状態ごとに分けて返る（07 §3.1/§3.5）', async () => {
    const { user, categoryId } = await setupUserWithCategory();
    // APIから編集できるのは今週・先週のみ（W-08）なので、それ以前はDB直接投入で用意する
    for (const week of [3, 2]) {
      const [checkRes] = await dataSource.query(
        `INSERT INTO weekly_checks (user_id, week_start) VALUES ($1, $2) RETURNING id`,
        [user.id, mondayWeeksAgo(week)],
      );
      await dataSource.query(
        `INSERT INTO weekly_check_entries (weekly_check_id, category_id, level) VALUES ($1, $2, 2)`,
        [checkRes.id, categoryId],
      );
    }
    for (const week of [1, 0]) {
      await request(app.getHttpServer())
        .put('/api/weekly-check')
        .set(authHeaders(user))
        .send({ weekStart: mondayWeeksAgo(week), entries: [{ categoryId, level: 2 }] })
        .expect(200);
    }

    const portfolio = await request(app.getHttpServer())
      .get('/api/portfolio?period=90')
      .set(authHeaders(user))
      .expect(200);

    // 総数（count）は返さない。確かな柱 / 育て中 / 習慣 に分けて返す
    expect(portfolio.body.pillars.count).toBeUndefined();
    const verified = portfolio.body.pillars.verified;
    expect(verified).toHaveLength(1);
    expect(verified[0].categoryId).toBe(categoryId);
    expect(verified[0].kind).toBe('relation');
    expect(verified[0].status).toBe('verified');
    expect(verified[0].activeWeeks).toBe(4);
  });

  // 06 §5「育成提案の扱い」: 独立機能としては廃止（W-A-11）。
  // 唯一の例外として、確かな柱0件が続いた人にだけ点検完了後に1回だけ静かに提示する（§5.2）
  describe('育成提案の廃止（06 §5）', () => {
    it('ポートフォリオに suggestion を返さない（W-A-11）', async () => {
      const { user, categoryId } = await setupUserWithCategory();
      await request(app.getHttpServer())
        .put('/api/weekly-check')
        .set(authHeaders(user))
        .send({ entries: [{ categoryId, level: 3 }] })
        .expect(200);

      const portfolio = await request(app.getHttpServer())
        .get('/api/portfolio?period=30')
        .set(authHeaders(user))
        .expect(200);

      expect(portfolio.body.suggestion).toBeUndefined();
    });

    it('PATCH /profile の suggestionMuted は受け付けない（トグルごと撤去）', async () => {
      const { user } = await setupUserWithCategory();
      await request(app.getHttpServer())
        .patch('/api/profile')
        .set(authHeaders(user))
        .send({ suggestionMuted: true })
        .expect(400);
    });

    it('点検3回目までは静かな提示を出さない', async () => {
      const { user } = await setupUserWithCategory();
      await insertEmptyChecks(user.id, [2]);

      const third = await request(app.getHttpServer())
        .put('/api/weekly-check')
        .set(authHeaders(user))
        .send({ weekStart: mondayWeeksAgo(1), entries: [] })
        .expect(200);

      expect(third.body.gentleNudge).toBeNull();
    });

    it('確かな柱0件のまま4回点検すると1回だけ静かな提示が届く（§5.2）', async () => {
      const { user } = await setupUserWithCategory();
      await insertEmptyChecks(user.id, [3, 2]);

      const third = await request(app.getHttpServer())
        .put('/api/weekly-check')
        .set(authHeaders(user))
        .send({ weekStart: mondayWeeksAgo(1), entries: [] })
        .expect(200);
      expect(third.body.gentleNudge).toBeNull();

      const fourth = await request(app.getHttpServer())
        .put('/api/weekly-check')
        .set(authHeaders(user))
        .send({ entries: [] })
        .expect(200);
      expect(fourth.body.gentleNudge).toContain('昔つながっていた人');

      // 二度目は出ない
      const again = await request(app.getHttpServer())
        .put('/api/weekly-check')
        .set(authHeaders(user))
        .send({ entries: [] })
        .expect(200);
      expect(again.body.gentleNudge).toBeNull();
    });

    it('確かな柱がある人には4回点検しても静かな提示を出さない', async () => {
      const { user, categoryId } = await setupUserWithCategory();
      for (const week of [3, 2]) {
        const [check] = await dataSource.query(
          `INSERT INTO weekly_checks (user_id, week_start) VALUES ($1, $2) RETURNING id`,
          [user.id, mondayWeeksAgo(week)],
        );
        await dataSource.query(
          `INSERT INTO weekly_check_entries (weekly_check_id, category_id, level) VALUES ($1, $2, 2)`,
          [check.id, categoryId],
        );
      }
      await request(app.getHttpServer())
        .put('/api/weekly-check')
        .set(authHeaders(user))
        .send({ weekStart: mondayWeeksAgo(1), entries: [{ categoryId, level: 2 }] })
        .expect(200);

      const fourth = await request(app.getHttpServer())
        .put('/api/weekly-check')
        .set(authHeaders(user))
        .send({ entries: [{ categoryId, level: 2 }] })
        .expect(200);

      expect(fourth.body.gentleNudge).toBeNull();
    });
  });

  /** APIから編集できるのは今週・先週のみ（W-08）なので、それ以前はDB直接投入で用意する */
  async function insertEmptyChecks(userId: string, weeksAgo: number[]): Promise<void> {
    for (const week of weeksAgo) {
      await dataSource.query(`INSERT INTO weekly_checks (user_id, week_start) VALUES ($1, $2)`, [
        userId,
        mondayWeeksAgo(week),
      ]);
    }
  }

  it('GET /weekly-check/current はカテゴリを直近の選択頻度順に並べる', async () => {
    const { user, categoryId } = await setupUserWithCategory();
    await request(app.getHttpServer())
      .put('/api/weekly-check')
      .set(authHeaders(user))
      .send({ weekStart: mondayWeeksAgo(1), entries: [{ categoryId, level: 1 }] })
      .expect(200);

    const current = await request(app.getHttpServer())
      .get('/api/weekly-check/current')
      .set(authHeaders(user))
      .expect(200);

    expect(current.body.weekStart).toBe(currentMonday);
    const opt = current.body.categories.find((c: { id: string }) => c.id === categoryId);
    expect(opt.selectionCount).toBeGreaterThanOrEqual(1);
  });
});
