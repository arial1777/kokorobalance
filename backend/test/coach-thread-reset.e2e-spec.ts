import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp, makeTestUser, authHeaders, cleanupUsers } from './utils/test-app';

describe('Coach thread reset (e2e)', () => {
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

  async function setupUser(): Promise<{ id: string; email: string }> {
    const user = makeTestUser();
    createdUserIds.push(user.id);
    await request(app.getHttpServer()).get('/api/profile').set(authHeaders(user)).expect(200);
    return user;
  }

  async function seedMessage(userId: string, content: string, createdAt: Date): Promise<void> {
    await dataSource.query(
      `INSERT INTO ai_coach_messages (user_id, role, content, created_at) VALUES ($1, 'user', $2, $3)`,
      [userId, content, createdAt],
    );
  }

  it('手動リセット後は表示上は空になるが、DB上の履歴は消えない', async () => {
    const user = await setupUser();
    await seedMessage(user.id, 'こんにちは', new Date());
    await seedMessage(user.id, '調子はどう', new Date());

    const before = await request(app.getHttpServer())
      .get('/api/coach/messages')
      .set(authHeaders(user))
      .expect(200);
    expect(before.body).toHaveLength(2);

    await request(app.getHttpServer()).post('/api/coach/reset').set(authHeaders(user)).expect(201);

    const after = await request(app.getHttpServer())
      .get('/api/coach/messages')
      .set(authHeaders(user))
      .expect(200);
    expect(after.body).toHaveLength(0);

    const rawCount = await dataSource.query('SELECT COUNT(*) FROM ai_coach_messages WHERE user_id = $1', [
      user.id,
    ]);
    expect(Number(rawCount[0].count)).toBe(2);
  });

  it('前日以前（4時境界より前）のメッセージは自動的に表示対象から外れる', async () => {
    const user = await setupUser();
    await seedMessage(user.id, '古いメッセージ', new Date('2020-01-01T00:00:00Z'));
    await seedMessage(user.id, '今のメッセージ', new Date());

    const res = await request(app.getHttpServer())
      .get('/api/coach/messages')
      .set(authHeaders(user))
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].content).toBe('今のメッセージ');
  });
});
