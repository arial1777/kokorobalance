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

  it('freeプランのユーザーはカスタムカテゴリを作成できない（Pro限定機能）', async () => {
    const user = makeTestUser();
    createdUserIds.push(user.id);

    // プロフィール行を用意する（free）
    const presetId = await firstPresetId();
    await request(app.getHttpServer())
      .post('/api/categories/bulk')
      .set(authHeaders(user))
      .send({ presetIds: [presetId] })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/categories')
      .set(authHeaders(user))
      .send({ name: 'テストカテゴリ', parentName: 'テスト', color: '#000000' })
      .expect(403);
  });

  it('Proプランのユーザーはカスタムカテゴリを自由な名前・グループで作成できる', async () => {
    const user = makeTestUser();
    createdUserIds.push(user.id);

    const presetId = await firstPresetId();
    await request(app.getHttpServer())
      .post('/api/categories/bulk')
      .set(authHeaders(user))
      .send({ presetIds: [presetId] })
      .expect(201);
    await dataSource.query("UPDATE profiles SET plan = 'pro' WHERE id = $1", [user.id]);

    const res = await request(app.getHttpServer())
      .post('/api/categories')
      .set(authHeaders(user))
      .send({ name: '推し活', parentName: '推し', color: '#E84393' })
      .expect(201);

    expect(res.body).toMatchObject({
      userId: user.id,
      name: '推し活',
      parentName: '推し',
      color: '#E84393',
      isPreset: false,
    });
  });
});
