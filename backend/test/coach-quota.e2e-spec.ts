import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp, makeTestUser, authHeaders, cleanupUsers } from './utils/test-app';

describe('Coach quota (e2e)', () => {
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

  async function setupUser(plan: 'free' | 'pro'): Promise<{ id: string; email: string }> {
    const user = makeTestUser();
    createdUserIds.push(user.id);
    await request(app.getHttpServer()).get('/api/profile').set(authHeaders(user)).expect(200);
    await request(app.getHttpServer()).post('/api/profile/ai-consent').set(authHeaders(user)).expect(201);
    if (plan === 'pro') {
      await dataSource.query("UPDATE profiles SET plan = 'pro' WHERE id = $1", [user.id]);
    }
    return user;
  }

  it('無料プランは1日1往復までで、2回目はQUOTA_EXCEEDEDになる', async () => {
    const user = await setupUser('free');
    await request(app.getHttpServer())
      .post('/api/coach/chat')
      .set(authHeaders(user))
      .send({ message: 'テストメッセージ' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/coach/chat')
      .set(authHeaders(user))
      .send({ message: 'もう一回' })
      .expect(403);
  });

  it('Proプランは無制限ではなく1日100回で打ち止めになる（コスト超過防止のソフトキャップ）', async () => {
    const user = await setupUser('pro');
    const now = new Date();
    // 100回分の実チャットは重いため、99回分をDBに直接投入して境界だけをまたぐ
    for (let i = 0; i < 99; i++) {
      await dataSource.query(
        `INSERT INTO ai_coach_messages (user_id, role, content, created_at) VALUES ($1, 'user', $2, $3)`,
        [user.id, `シード${i}`, now],
      );
    }

    const quotaBefore = await request(app.getHttpServer())
      .get('/api/coach/quota')
      .set(authHeaders(user))
      .expect(200);
    expect(quotaBefore.body).toMatchObject({ plan: 'pro', limit: 100, used: 99, remaining: 1 });

    await request(app.getHttpServer())
      .post('/api/coach/chat')
      .set(authHeaders(user))
      .send({ message: '100回目' })
      .expect(201);

    const quotaAfter = await request(app.getHttpServer())
      .get('/api/coach/quota')
      .set(authHeaders(user))
      .expect(200);
    expect(quotaAfter.body).toMatchObject({ plan: 'pro', limit: 100, used: 100, remaining: 0 });

    await request(app.getHttpServer())
      .post('/api/coach/chat')
      .set(authHeaders(user))
      .send({ message: '101回目のはず、拒否されるべき' })
      .expect(403);
  });

  it('quotaはisShakeTodayを含む', async () => {
    const user = await setupUser('free');
    const res = await request(app.getHttpServer())
      .get('/api/coach/quota')
      .set(authHeaders(user))
      .expect(200);
    expect(res.body).toMatchObject({ plan: 'free', limit: 1, used: 0, remaining: 1, isShakeToday: false });
  });
});
