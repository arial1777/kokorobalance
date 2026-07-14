import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp, makeTestUser, authHeaders, cleanupUsers } from './utils/test-app';

describe('Records ownership (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  const createdUserIds: string[] = [];

  const victim = makeTestUser();
  const attacker = makeTestUser();
  let victimCategoryId: string;
  let attackerCategoryId: string;

  beforeAll(async () => {
    ({ app, dataSource } = await createTestApp());
    createdUserIds.push(victim.id, attacker.id);

    const presetsRes = await request(app.getHttpServer()).get('/api/categories/presets').expect(200);
    const [presetA, presetB] = presetsRes.body;

    const victimCats = await request(app.getHttpServer())
      .post('/api/categories/bulk')
      .set(authHeaders(victim))
      .send({ presetIds: [presetA.id] })
      .expect(201);
    victimCategoryId = victimCats.body[0].id;

    const attackerCats = await request(app.getHttpServer())
      .post('/api/categories/bulk')
      .set(authHeaders(attacker))
      .send({ presetIds: [presetB.id] })
      .expect(201);
    attackerCategoryId = attackerCats.body[0].id;
  });

  afterAll(async () => {
    await cleanupUsers(dataSource, createdUserIds);
    await app.close();
  });

  it('他ユーザーのカテゴリIDを指定した記録保存は拒否される（IDOR対策）', async () => {
    await request(app.getHttpServer())
      .post('/api/records')
      .set(authHeaders(attacker))
      .send({
        recordedDate: '2026-01-01',
        items: [{ categoryId: victimCategoryId, score: 2 }],
      })
      .expect(403);
  });

  it('自分のカテゴリIDを指定した記録保存は成功する', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/records')
      .set(authHeaders(attacker))
      .send({
        recordedDate: '2026-01-01',
        items: [{ categoryId: attackerCategoryId, score: 2 }],
      })
      .expect(201);

    expect(res.body.record.items[0].categoryId).toBe(attackerCategoryId);
  });

  it('他ユーザーのカテゴリIDを指定した揺らぎイベントは拒否される（IDOR対策）', async () => {
    await request(app.getHttpServer())
      .post('/api/records/fluctuations')
      .set(authHeaders(attacker))
      .send({ occurredDate: '2026-01-01', categoryId: victimCategoryId, magnitude: 'small' })
      .expect(403);
  });

  it('自分のカテゴリIDを指定した揺らぎイベントは成功する', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/records/fluctuations')
      .set(authHeaders(attacker))
      .send({ occurredDate: '2026-01-01', categoryId: attackerCategoryId, magnitude: 'small' })
      .expect(201);

    expect(res.body.categoryId).toBe(attackerCategoryId);
  });
});
