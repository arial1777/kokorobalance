import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp, makeTestUser, authHeaders, cleanupUsers } from './utils/test-app';

describe('Categories (e2e)', () => {
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

  async function firstPresetId(): Promise<string> {
    const res = await request(app.getHttpServer()).get('/api/categories/presets').expect(200);
    return res.body[0].id;
  }

  it('プロフィール行が未作成の新規ユーザーでもプリセット一括追加ができる（プロフィール自動作成の回帰テスト）', async () => {
    const user = makeTestUser();
    createdUserIds.push(user.id);

    const before = await dataSource.query('SELECT 1 FROM profiles WHERE id = $1', [user.id]);
    expect(before).toHaveLength(0);

    const presetId = await firstPresetId();
    const res = await request(app.getHttpServer())
      .post('/api/categories/bulk')
      .set(authHeaders(user))
      .send({ presetIds: [presetId] })
      .expect(201);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].userId).toBe(user.id);

    const profileRows = await dataSource.query('SELECT plan FROM profiles WHERE id = $1', [user.id]);
    expect(profileRows).toHaveLength(1);
    expect(profileRows[0].plan).toBe('free');
  });

  // 柱を自分の言葉で書けることは新しいモデルの根幹なので Free でも使える
  // （07 P-10、10-pricing-b2b.md §2.3「柱（3型・承認）」は Free ○）
  it('freeプランのユーザーも柱を自由な名前・型で作成できる', async () => {
    const user = makeTestUser();
    createdUserIds.push(user.id);

    const presetId = await firstPresetId();
    await request(app.getHttpServer())
      .post('/api/categories/bulk')
      .set(authHeaders(user))
      .send({ presetIds: [presetId] })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/api/categories')
      .set(authHeaders(user))
      .send({ name: '木曜のバンド', parentName: '居場所', color: '#E84393', kind: 'place', importance: 3 })
      .expect(201);

    expect(res.body).toMatchObject({
      userId: user.id,
      name: '木曜のバンド',
      kind: 'place',
      importance: 3,
      isPreset: false,
    });

    const profileRows = await dataSource.query('SELECT plan FROM profiles WHERE id = $1', [user.id]);
    expect(profileRows[0].plan).toBe('free');
  });

  it('プリセット由来の柱には kind が引き継がれる（「人」グループは relation）', async () => {
    const user = makeTestUser();
    createdUserIds.push(user.id);

    const presets = await request(app.getHttpServer()).get('/api/categories/presets').expect(200);
    const hito = presets.body.find((p: { parentName: string }) => p.parentName === '人');
    expect(hito.kind).toBe('relation');

    const res = await request(app.getHttpServer())
      .post('/api/categories/bulk')
      .set(authHeaders(user))
      .send({ presetIds: [hito.id] })
      .expect(201);
    expect(res.body[0].kind).toBe('relation');
  });
});
