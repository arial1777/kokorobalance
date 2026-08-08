import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp, makeTestUser, authHeaders, cleanupUsers } from './utils/test-app';
import { GeminiService } from '../src/common/gemini.service';

describe('Safety detection (e2e)', () => {
  jest.setTimeout(30000);
  let app: INestApplication<App>;
  let dataSource: DataSource;
  const createdUserIds: string[] = [];
  const fakeGenerate = jest.fn();

  beforeAll(async () => {
    // 分類器(第2段)のフォールバック挙動を検証するため、SafetyServiceのAI_STUBを無効化しつつ
    // GeminiServiceを差し替える（実APIには到達しない）。
    process.env.AI_STUB = 'false';
    ({ app, dataSource } = await createTestApp((builder) =>
      builder.overrideProvider(GeminiService).useValue({ generate: fakeGenerate }),
    ));

    // カテゴリ別窓口の出し分けを検証するためのテスト専用ルール（本番辞書には含めない）
    await dataSource.query(
      `INSERT INTO safety_rules (rule_id, category, verdict, pattern)
       VALUES ('TEST-ABUSE-01', 'abuse', 'block', 'えぬいーせーふてぃてすとことば')
       ON CONFLICT (rule_id) DO NOTHING`,
    );
  });

  afterAll(async () => {
    delete process.env.AI_STUB;
    await dataSource.query(`DELETE FROM safety_rules WHERE rule_id = 'TEST-ABUSE-01'`);
    await cleanupUsers(dataSource, createdUserIds);
    await app.close();
  });

  beforeEach(() => {
    fakeGenerate.mockReset();
  });

  async function setupUser(): Promise<{ id: string; email: string }> {
    const user = makeTestUser();
    createdUserIds.push(user.id);
    await request(app.getHttpServer()).get('/api/profile').set(authHeaders(user)).expect(200);
    await request(app.getHttpServer()).post('/api/profile/ai-consent').set(authHeaders(user)).expect(201);
    return user;
  }

  it('決定的ルールに該当する入力はAIを呼ばずblockになる', async () => {
    const user = await setupUser();

    const res = await request(app.getHttpServer())
      .post('/api/coach/chat')
      .set(authHeaders(user))
      .send({ message: '死にたい気持ちがずっと消えません' })
      .expect(201);

    expect(res.body.verdict).toBe('block');
    expect(res.body.crisis).toBe(true);
    expect(fakeGenerate).not.toHaveBeenCalled();
  });

  it('分類器がエラー・タイムアウトした場合はclearではなくcautionにフォールバックする', async () => {
    // 分類器呼び出し(JSON指定)だけを失敗させ、通常の応答生成呼び出しは成功させる
    fakeGenerate.mockImplementation(
      async (_system: string, _messages: unknown[], options?: { responseMimeType?: string }) => {
        if (options?.responseMimeType === 'application/json') {
          throw new Error('simulated timeout');
        }
        return 'caution応答テスト';
      },
    );
    const user = await setupUser();

    const res = await request(app.getHttpServer())
      .post('/api/coach/chat')
      .set(authHeaders(user))
      .send({ message: 'ルールに該当しない、しかし分類器を呼ぶ普通のメッセージです' })
      .expect(201);

    expect(res.body.verdict).toBe('caution');
    expect(res.body.crisis).toBe(false);
  });

  it('分類器がclearを返せば通常応答になる', async () => {
    fakeGenerate.mockImplementation(async (_system: string, _messages: unknown[], options?: { responseMimeType?: string }) => {
      if (options?.responseMimeType === 'application/json') {
        return JSON.stringify({ verdict: 'clear', category: null });
      }
      return 'テスト応答です';
    });
    const user = await setupUser();

    const res = await request(app.getHttpServer())
      .post('/api/coach/chat')
      .set(authHeaders(user))
      .send({ message: '今日は天気がよくて気持ちいいです' })
      .expect(201);

    expect(res.body.verdict).toBe('clear');
    expect(res.body.reply).toBe('テスト応答です');
  });

  it('カテゴリ別に窓口が切り替わる（abuseカテゴリのルールにヒットするとDV窓口が含まれる）', async () => {
    const user = await setupUser();

    const res = await request(app.getHttpServer())
      .post('/api/coach/chat')
      .set(authHeaders(user))
      .send({ message: '今日はえぬいーせーふてぃてすとことばがあった' })
      .expect(201);

    expect(res.body.verdict).toBe('block');
    const names = res.body.hotlines.map((h: { name: string }) => h.name);
    expect(names).toContain('DV相談＋（プラス）');
    expect(names).not.toContain('いのちの電話');
  });

  it('safety_eventsに本文が保存されず、ハッシュのみが記録される', async () => {
    const user = await setupUser();

    await request(app.getHttpServer())
      .post('/api/coach/chat')
      .set(authHeaders(user))
      .send({ message: '死にたい' })
      .expect(201);

    const rows = await dataSource.query(`SELECT * FROM safety_events WHERE user_id = $1`, [user.id]);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(Object.values(row).some((v) => typeof v === 'string' && v.includes('死にたい'))).toBe(false);
      expect(row.raw_excerpt_hash).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('FluctuationEvent.note経由でも検知が動作し、blockでも保存自体は成功する', async () => {
    const user = await setupUser();

    const res = await request(app.getHttpServer())
      .post('/api/records/fluctuations')
      .set(authHeaders(user))
      .send({ occurredDate: '2026-01-01', magnitude: 'large', note: '消えてしまいたいと思った' })
      .expect(201);

    expect(res.body.safetyVerdict).toBe('block');
    expect(res.body.event.note).toBe('消えてしまいたいと思った');
    expect(res.body.hotlines.length).toBeGreaterThan(0);
  });

  it('揺らぎメモが安全な内容ならclearで保存され、窓口は返らない', async () => {
    fakeGenerate.mockResolvedValue(JSON.stringify({ verdict: 'clear', category: null }));
    const user = await setupUser();

    const res = await request(app.getHttpServer())
      .post('/api/records/fluctuations')
      .set(authHeaders(user))
      .send({ occurredDate: '2026-01-01', magnitude: 'small', note: '友達とカフェに行った' })
      .expect(201);

    expect(res.body.safetyVerdict).toBe('clear');
    expect(res.body.hotlines).toEqual([]);
  });

  it('「この返信は的外れ」報告が自分のメッセージに対して成功する', async () => {
    fakeGenerate.mockResolvedValue(JSON.stringify({ verdict: 'clear', category: null }));
    const user = await setupUser();

    const chatRes = await request(app.getHttpServer())
      .post('/api/coach/chat')
      .set(authHeaders(user))
      .send({ message: '報告ボタンのテスト用メッセージです' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/coach/messages/${chatRes.body.messageId}/report`)
      .set(authHeaders(user))
      .expect(201);

    const [row] = await dataSource.query(`SELECT reported_off_base_at FROM ai_coach_messages WHERE id = $1`, [
      chatRes.body.messageId,
    ]);
    expect(row.reported_off_base_at).not.toBeNull();
  });
});
