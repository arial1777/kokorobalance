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

  it('無料プランは月3回までで、4回目はQUOTA_EXCEEDEDになる', async () => {
    const user = await setupUser('free');
    for (let i = 0; i < 3; i++) {
      await request(app.getHttpServer())
        .post('/api/coach/chat')
        .set(authHeaders(user))
        .send({ message: `テストメッセージ${i}` })
        .expect(201);
    }

    await request(app.getHttpServer())
      .post('/api/coach/chat')
      .set(authHeaders(user))
      .send({ message: 'もう一回' })
      .expect(403);
  });

  it('Proプランは無制限ではなく月100回で打ち止めになる（コスト超過防止のソフトキャップ）', async () => {
    const user = await setupUser('pro');
    const month = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date()).slice(0, 7);
    // 100回分の実チャットは重いため、99回分をDBに直接投入して境界だけをまたぐ
    await dataSource.query(
      `INSERT INTO ai_usage (user_id, month, chat_count) VALUES ($1, $2, 99)`,
      [user.id, month],
    );

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
});
