import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp, makeTestUser, authHeaders, cleanupUsers } from './utils/test-app';

/** ペア（09-spec-pair.md）。共有情報を極小に保つことがこの機能の中心的な要件 */
describe('Pair (e2e)', () => {
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

  async function setupUser(nickname?: string): Promise<{ id: string; email: string }> {
    const user = makeTestUser();
    createdUserIds.push(user.id);
    await request(app.getHttpServer()).get('/api/profile').set(authHeaders(user)).expect(200);
    if (nickname) {
      await dataSource.query('UPDATE profiles SET nickname = $1 WHERE id = $2', [nickname, user.id]);
    }
    return user;
  }

  async function createPillar(
    user: { id: string; email: string },
    name: string,
    kind: 'place' | 'relation' | 'habit' = 'place',
  ): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/categories')
      .set(authHeaders(user))
      .send({ name, parentName: 'テスト', color: '#123456', kind })
      .expect(201);
    return res.body.id;
  }

  /** 招待〜受諾までを済ませたペアを作る */
  async function makePair(): Promise<{ a: { id: string; email: string }; b: { id: string; email: string } }> {
    const a = await setupUser('あやか');
    const b = await setupUser('みかん');
    const invite = await request(app.getHttpServer()).post('/api/pair/invite').set(authHeaders(a)).expect(201);
    await request(app.getHttpServer())
      .post('/api/pair/accept')
      .set(authHeaders(b))
      .send({ code: invite.body.code })
      .expect(201);
    return { a, b };
  }

  it('招待コードで1対1のペアが成立する（PR-A-01）', async () => {
    const { a, b } = await makePair();

    const viewA = await request(app.getHttpServer()).get('/api/pair').set(authHeaders(a)).expect(200);
    expect(viewA.body.state).toBe('active');
    expect(viewA.body.partner.displayName).toBe('みかん');

    const viewB = await request(app.getHttpServer()).get('/api/pair').set(authHeaders(b)).expect(200);
    expect(viewB.body.state).toBe('active');
    expect(viewB.body.partner.displayName).toBe('あやか');
  });

  it('期限切れの招待コードは使えない（E-01）', async () => {
    const a = await setupUser();
    const b = await setupUser();
    const invite = await request(app.getHttpServer()).post('/api/pair/invite').set(authHeaders(a)).expect(201);
    await dataSource.query(
      `UPDATE pairs SET invite_expires_at = now() - INTERVAL '1 day' WHERE user_a_id = $1`,
      [a.id],
    );

    const res = await request(app.getHttpServer())
      .post('/api/pair/accept')
      .set(authHeaders(b))
      .send({ code: invite.body.code })
      .expect(404);
    expect(res.body.message).toContain('使えなくなっています');
  });

  it('自分の招待コードは使えない', async () => {
    const a = await setupUser();
    const invite = await request(app.getHttpServer()).post('/api/pair/invite').set(authHeaders(a)).expect(201);
    await request(app.getHttpServer())
      .post('/api/pair/accept')
      .set(authHeaders(a))
      .send({ code: invite.body.code })
      .expect(400);
  });

  it('相手が既にペアを持つ場合、相手が誰かを伝えずに断る（E-02）', async () => {
    const { a } = await makePair();
    // a は既にペア済み。新しい招待は作れない（PR-01）
    await request(app.getHttpServer()).post('/api/pair/invite').set(authHeaders(a)).expect(403);

    // 別ルート: 招待を出した後にその本人が別ペアを持った場合
    const c = await setupUser('しずか');
    const d = await setupUser();
    const invite = await request(app.getHttpServer()).post('/api/pair/invite').set(authHeaders(c)).expect(201);
    const e = await setupUser();
    await request(app.getHttpServer())
      .post('/api/pair/accept')
      .set(authHeaders(e))
      .send({ code: invite.body.code })
      .expect(201);

    // 同じコードをもう一度使おうとしても成立しない
    const res = await request(app.getHttpServer())
      .post('/api/pair/accept')
      .set(authHeaders(d))
      .send({ code: invite.body.code })
      .expect(404);
    expect(JSON.stringify(res.body)).not.toContain('しずか');
  });

  it('活動中のペアは同時に1つだけ（PR-01）', async () => {
    const { b } = await makePair();
    const other = await setupUser();
    const invite = await request(app.getHttpServer()).post('/api/pair/invite').set(authHeaders(other)).expect(201);

    await request(app.getHttpServer())
      .post('/api/pair/accept')
      .set(authHeaders(b))
      .send({ code: invite.body.code })
      .expect(403);
  });

  it('共有情報に柱のラベル・本数・構成比・メモ・壁打ちが含まれない（PR-A-03）', async () => {
    const { a, b } = await makePair();
    await createPillar(b, 'ひみつの柱', 'place');
    await createPillar(b, 'ないしょの相手', 'relation');
    await request(app.getHttpServer())
      .put('/api/weekly-check')
      .set(authHeaders(b))
      .send({ entries: [], moodNote: 'これは誰にも見せたくないメモ' })
      .expect(200);

    const view = await request(app.getHttpServer()).get('/api/pair').set(authHeaders(a)).expect(200);
    const body = JSON.stringify(view.body);

    expect(body).not.toContain('ひみつの柱');
    expect(body).not.toContain('ないしょの相手');
    expect(body).not.toContain('これは誰にも見せたくないメモ');
    // 本数・構成比を示すフィールドを持たない
    expect(view.body.partner.pillarCount).toBeUndefined();
    expect(view.body.partner.breakdown).toBeUndefined();
    // 共有されるのは「今週点検したか」の2値だけ
    expect(typeof view.body.partner.checkedThisWeek).toBe('boolean');
  });

  it('柱の色スロットは常に5個で固定される（PR-A-12）', async () => {
    const { a, b } = await makePair();
    const view0 = await request(app.getHttpServer()).get('/api/pair').set(authHeaders(a)).expect(200);
    expect(view0.body.partner.pillarSlots).toHaveLength(5);

    // 8本の確かな柱を作っても5個のまま（数えられる形にしない）
    for (let i = 0; i < 8; i++) {
      const id = await createPillar(b, `柱${i}`, 'place');
      await dataSource.query(
        `UPDATE categories SET verified_at = now(), verification_source = 'self_declared' WHERE id = $1`,
        [id],
      );
    }
    const view = await request(app.getHttpServer()).get('/api/pair').set(authHeaders(a)).expect(200);
    expect(view.body.partner.pillarSlots).toHaveLength(5);
    const verifiedSlots = view.body.partner.pillarSlots.filter((s: { kind: string }) => s.kind === 'verified');
    expect(verifiedSlots.length).toBeLessThanOrEqual(3);
  });

  it('「知っている」で確かな柱になり、source が pair になる', async () => {
    const { a, b } = await makePair();
    const pillarId = await createPillar(a, '木曜のバンド', 'place');

    await request(app.getHttpServer())
      .post('/api/pair/requests')
      .set(authHeaders(a))
      .send({ categoryId: pillarId })
      .expect(201);

    const viewB = await request(app.getHttpServer()).get('/api/pair').set(authHeaders(b)).expect(200);
    expect(viewB.body.incomingRequests).toHaveLength(1);
    // 依頼された柱のラベルだけは相手に見える（§3.1 の明示的な例外）
    expect(viewB.body.incomingRequests[0].pillarLabel).toBe('木曜のバンド');

    await request(app.getHttpServer())
      .post(`/api/pair/requests/${viewB.body.incomingRequests[0].id}/respond`)
      .set(authHeaders(b))
      .send({ answer: 'known' })
      .expect(201);

    const [row] = await dataSource.query(
      'SELECT verified_at, verification_source FROM categories WHERE id = $1',
      [pillarId],
    );
    expect(row.verified_at).not.toBeNull();
    expect(row.verification_source).toBe('pair');
  });

  it('「よく知らない」は依頼者に「見た」としか伝わらない（PR-A-05）', async () => {
    const { a, b } = await makePair();
    const pillarId = await createPillar(a, '不安な柱', 'place');
    await request(app.getHttpServer())
      .post('/api/pair/requests')
      .set(authHeaders(a))
      .send({ categoryId: pillarId })
      .expect(201);

    const viewB = await request(app.getHttpServer()).get('/api/pair').set(authHeaders(b)).expect(200);
    await request(app.getHttpServer())
      .post(`/api/pair/requests/${viewB.body.incomingRequests[0].id}/respond`)
      .set(authHeaders(b))
      .send({ answer: 'unsure' })
      .expect(201);

    const viewA = await request(app.getHttpServer()).get('/api/pair').set(authHeaders(a)).expect(200);
    expect(viewA.body.outgoingRequests).toHaveLength(1);
    expect(viewA.body.outgoingRequests[0].state).toBe('seen');
    // 「知らない」と読み取れる情報が一切含まれない
    const body = JSON.stringify(viewA.body);
    expect(body).not.toContain('unsure');
    expect(body).not.toContain('known');
    expect(viewA.body.outgoingRequests[0].answer).toBeUndefined();

    // 承認されていないので柱は育て中のまま
    const [row] = await dataSource.query('SELECT verified_at FROM categories WHERE id = $1', [pillarId]);
    expect(row.verified_at).toBeNull();
  });

  it('習慣は承認を依頼できない', async () => {
    const { a } = await makePair();
    const habitId = await createPillar(a, '朝の散歩', 'habit');
    await request(app.getHttpServer())
      .post('/api/pair/requests')
      .set(authHeaders(a))
      .send({ categoryId: habitId })
      .expect(400);
  });

  it('柱のラベルがセーフティ検知に触れると依頼を送らず窓口を返す（E-07）', async () => {
    const { a, b } = await makePair();
    const categoryId = await createPillar(a, '死にたい', 'place');

    const res = await request(app.getHttpServer())
      .post('/api/pair/requests')
      .set(authHeaders(a))
      .send({ categoryId })
      .expect(201);

    // 成功として返さない。フロントはこれを見て窓口を出す（トーストで握り潰さない）
    expect(res.body.requested).toBe(false);
    expect(res.body.safetyVerdict).toBe('block');
    expect(res.body.hotlines.length).toBeGreaterThan(0);

    // 相手には依頼が届いていない
    const viewB = await request(app.getHttpServer()).get('/api/pair').set(authHeaders(b)).expect(200);
    expect(viewB.body.incomingRequests).toHaveLength(0);

    // 依頼者側にも「お願い中」が残らない
    const viewA = await request(app.getHttpServer()).get('/api/pair').set(authHeaders(a)).expect(200);
    expect(viewA.body.outgoingRequests).toHaveLength(0);
  });

  it('揺れそうな日はタイトルを既定で共有せず、共有を選んだときだけ出す（§2.1 / E-09）', async () => {
    const { a, b } = await makePair();
    const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date());
    const created = await request(app.getHttpServer())
      .post('/api/shake/events')
      .set(authHeaders(b))
      .send({ templateKey: 'exam_day', eventDate: today, title: '大事な発表の日' })
      .expect(201);

    const before = await request(app.getHttpServer()).get('/api/pair').set(authHeaders(a)).expect(200);
    expect(before.body.partner.upcomingShake).not.toBeNull();
    expect(before.body.partner.upcomingShake.title).toBeNull();
    expect(JSON.stringify(before.body)).not.toContain('大事な発表の日');

    await request(app.getHttpServer())
      .patch(`/api/shake/events/${created.body.event.id}`)
      .set(authHeaders(b))
      .send({ shareTitleWithPair: true })
      .expect(200);

    const after = await request(app.getHttpServer()).get('/api/pair').set(authHeaders(a)).expect(200);
    expect(after.body.partner.upcomingShake.title).toBe('大事な発表の日');
  });

  it('セーフティ検知の事実がペアに共有されない（PR-A-09）', async () => {
    const { a, b } = await makePair();
    await request(app.getHttpServer())
      .put('/api/weekly-check')
      .set(authHeaders(b))
      .send({ entries: [], moodNote: '死にたい気持ちがある' })
      .expect(200);

    const view = await request(app.getHttpServer()).get('/api/pair').set(authHeaders(a)).expect(200);
    const body = JSON.stringify(view.body);
    expect(body).not.toContain('死にたい');
    expect(body).not.toContain('safety');
    expect(body).not.toContain('block');
    expect(body).not.toContain('caution');
  });

  it('解消すると共有情報が即座に見えなくなり、pair承認は07§3.4で処理される（PR-A-08 / PR-07）', async () => {
    const { a, b } = await makePair();
    const pillarId = await createPillar(a, '解消後の柱', 'place');
    await request(app.getHttpServer())
      .post('/api/pair/requests')
      .set(authHeaders(a))
      .send({ categoryId: pillarId })
      .expect(201);
    const viewB = await request(app.getHttpServer()).get('/api/pair').set(authHeaders(b)).expect(200);
    await request(app.getHttpServer())
      .post(`/api/pair/requests/${viewB.body.incomingRequests[0].id}/respond`)
      .set(authHeaders(b))
      .send({ answer: 'known' })
      .expect(201);

    await request(app.getHttpServer()).delete('/api/pair').set(authHeaders(a)).expect(200);

    for (const u of [a, b]) {
      const after = await request(app.getHttpServer()).get('/api/pair').set(authHeaders(u)).expect(200);
      expect(after.body.state).toBeNull();
      expect(after.body.partner).toBeNull();
    }

    // 点検の実績がないので recurring_check の条件を満たさず、育て中に戻る
    const [row] = await dataSource.query(
      'SELECT verified_at, verification_source FROM categories WHERE id = $1',
      [pillarId],
    );
    expect(row.verified_at).toBeNull();
    expect(row.verification_source).toBeNull();
  });

  it('解消から7日以内は同じ相手と再ペアできない（PR-09）', async () => {
    const { a, b } = await makePair();
    await request(app.getHttpServer()).delete('/api/pair').set(authHeaders(a)).expect(200);

    const invite = await request(app.getHttpServer()).post('/api/pair/invite').set(authHeaders(a)).expect(201);
    const res = await request(app.getHttpServer())
      .post('/api/pair/accept')
      .set(authHeaders(b))
      .send({ code: invite.body.code })
      .expect(403);
    expect(res.body.message).toContain('7日');
  });

  it('一時停止すると共有が止まり、再開すると戻る（PR-08）', async () => {
    const { a, b } = await makePair();
    await request(app.getHttpServer()).post('/api/pair/pause').set(authHeaders(a)).expect(201);

    const paused = await request(app.getHttpServer()).get('/api/pair').set(authHeaders(b)).expect(200);
    expect(paused.body.state).toBe('paused');
    expect(paused.body.partner).toBeNull();

    await request(app.getHttpServer()).post('/api/pair/resume').set(authHeaders(b)).expect(201);
    const resumed = await request(app.getHttpServer()).get('/api/pair').set(authHeaders(a)).expect(200);
    expect(resumed.body.state).toBe('active');
    expect(resumed.body.partner).not.toBeNull();
  });

  it('7日反応がない依頼は静かに取り下げられる（E-03）', async () => {
    const { a, b } = await makePair();
    const pillarId = await createPillar(a, '放置される柱', 'place');
    await request(app.getHttpServer())
      .post('/api/pair/requests')
      .set(authHeaders(a))
      .send({ categoryId: pillarId })
      .expect(201);

    await dataSource.query(
      `UPDATE pillar_verification_requests SET created_at = now() - INTERVAL '8 days' WHERE category_id = $1`,
      [pillarId],
    );

    const viewA = await request(app.getHttpServer()).get('/api/pair').set(authHeaders(a)).expect(200);
    expect(viewA.body.outgoingRequests).toHaveLength(0);
    const viewB = await request(app.getHttpServer()).get('/api/pair').set(authHeaders(b)).expect(200);
    expect(viewB.body.incomingRequests).toHaveLength(0);
    // 「無視された」と読み取れる情報を返さない
    expect(JSON.stringify(viewA.body)).not.toContain('withdrawn');
  });

  it('ペアがいなければ空の状態を返す', async () => {
    const user = await setupUser();
    const view = await request(app.getHttpServer()).get('/api/pair').set(authHeaders(user)).expect(200);
    expect(view.body).toMatchObject({ state: null, partner: null, invite: null });
    expect(view.body.incomingRequests).toEqual([]);
  });
});
