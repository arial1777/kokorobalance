import { ForbiddenException, HttpException, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { AiCoachMessage } from './ai-coach-message.entity';
import { AiUsage } from './ai-usage.entity';
import { CrisisDetectorService } from './crisis-detector.service';
import { PortfolioService } from '../portfolio/portfolio.service';
import { Profile } from '../profile/profile.entity';
import { GeminiService } from '../common/gemini.service';

/** 無料プランの月間チャット回数上限（v2 §5.1.7） */
export const FREE_MONTHLY_LIMIT = 3;

export interface CoachQuota {
  plan: 'free' | 'pro';
  limit: number | null;
  used: number;
  remaining: number | null;
}

export interface ChatResult {
  reply: string;
  messageId: string;
  crisis: boolean;
}

const STUB_REPLIES = [
  'よく話してくれましたね。ポートフォリオを見ると、最近は特定の柱に支えが集まっているようです。今週は普段やらないことを一つ、5分だけ試してみませんか？',
  'その気持ち、よくわかります。心の柱を保つには、小さな楽しみを複数持つことが大切です。今日は5分だけ好きな音楽を聴いてみてください。',
  '教えてくれてありがとうございます。記録を見ると、育てかけの柱がいくつかあります。友達に連絡を一本入れてみるのはいかがでしょうか？',
  'なるほど、そう感じているのですね。いまのバランスは悪くないですが、健康の柱がすこし細めです。明日の朝、10分だけ散歩してみましょう。',
];

@Injectable()
export class CoachService {
  private readonly isStub: boolean;
  private stubReplyIndex = 0;

  constructor(
    @InjectRepository(AiCoachMessage)
    private readonly messageRepo: Repository<AiCoachMessage>,
    @InjectRepository(AiUsage)
    private readonly usageRepo: Repository<AiUsage>,
    @InjectRepository(Profile)
    private readonly profileRepo: Repository<Profile>,
    @InjectDataSource()
    private readonly ds: DataSource,
    private readonly portfolioService: PortfolioService,
    private readonly crisisDetector: CrisisDetectorService,
    private readonly gemini: GeminiService,
    private readonly config: ConfigService,
  ) {
    // AI_STUB を明示的に 'false' にした場合のみ実API呼び出しに切り替える(デフォルトは安全側でスタブ)
    this.isStub = config.get<string>('AI_STUB') !== 'false';
  }

  getMessages(userId: string): Promise<AiCoachMessage[]> {
    return this.messageRepo.find({
      where: { userId },
      order: { createdAt: 'ASC' },
      take: 50,
    });
  }

  async getQuota(userId: string): Promise<CoachQuota> {
    const profile = await this.profileRepo.findOne({ where: { id: userId } });
    const plan = profile?.plan ?? 'free';
    const used = await this.getMonthlyUsage(userId);
    if (plan === 'pro') {
      return { plan, limit: null, used, remaining: null };
    }
    return {
      plan,
      limit: FREE_MONTHLY_LIMIT,
      used,
      remaining: Math.max(0, FREE_MONTHLY_LIMIT - used),
    };
  }

  async chat(userId: string, userMessage: string): Promise<ChatResult> {
    const profile = await this.profileRepo.findOne({ where: { id: userId } });

    // AI送信への明示同意（v2 §7.3）。未同意なら 428 を返しフロントで同意を取る
    if (!profile?.aiConsentAt) {
      throw new HttpException('AI_CONSENT_REQUIRED', 428);
    }

    // クライシス検知（v2 §7.2）: AIに送らず固定応答で相談窓口を案内。無料枠も消費しない
    if (this.crisisDetector.detect(userMessage)) {
      const reply = this.crisisDetector.buildCrisisReply();
      const messageId = await this.saveExchange(userId, userMessage, reply, true);
      return { reply, messageId, crisis: true };
    }

    // 無料枠チェック（Proは無制限）
    if (profile.plan !== 'pro') {
      const used = await this.getMonthlyUsage(userId);
      if (used >= FREE_MONTHLY_LIMIT) {
        throw new ForbiddenException('QUOTA_EXCEEDED');
      }
    }

    const reply = this.isStub
      ? this.stubReply()
      : await this.callAi(userId, userMessage);

    const messageId = await this.saveExchange(userId, userMessage, reply, false);
    await this.incrementUsage(userId);

    return { reply, messageId, crisis: false };
  }

  private async saveExchange(
    userId: string,
    userMessage: string,
    reply: string,
    isCrisis: boolean,
  ): Promise<string> {
    await this.messageRepo.save(
      this.messageRepo.create({ userId, role: 'user', content: userMessage, isCrisis }),
    );
    const assistant = await this.messageRepo.save(
      this.messageRepo.create({ userId, role: 'assistant', content: reply, isCrisis }),
    );
    return assistant.id;
  }

  private currentMonthJST(): string {
    return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' })
      .format(new Date())
      .slice(0, 7);
  }

  private async getMonthlyUsage(userId: string): Promise<number> {
    const row = await this.usageRepo.findOne({
      where: { userId, month: this.currentMonthJST() },
    });
    return row?.chatCount ?? 0;
  }

  /** コスト把握のためProも含めて全ユーザーの利用回数を記録する（v2 §9.2） */
  private async incrementUsage(userId: string): Promise<void> {
    await this.ds.query(
      `INSERT INTO ai_usage (user_id, month, chat_count)
       VALUES ($1, $2, 1)
       ON CONFLICT (user_id, month)
       DO UPDATE SET chat_count = ai_usage.chat_count + 1`,
      [userId, this.currentMonthJST()],
    );
  }

  private stubReply(): string {
    const reply = STUB_REPLIES[this.stubReplyIndex % STUB_REPLIES.length];
    this.stubReplyIndex++;
    return reply;
  }

  private async callAi(userId: string, userMessage: string): Promise<string> {
    const portfolio = await this.portfolioService.getPortfolio(userId, 30);
    const recentFluctuations = await this.ds.query<
      { occurred_date: string; magnitude: string; name: string | null }[]
    >(
      `SELECT f.occurred_date::text AS occurred_date, f.magnitude, c.name
       FROM fluctuation_events f
       LEFT JOIN categories c ON c.id = f.category_id
       WHERE f.user_id = $1 AND f.occurred_date >= CURRENT_DATE - INTERVAL '14 days'
       ORDER BY f.occurred_date DESC
       LIMIT 5`,
      [userId],
    );
    const history = await this.messageRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 10,
    });

    const systemPrompt = `あなたは心のバランスコーチです。ユーザーの「心のポートフォリオ」データをもとに、日本語で応答してください。

## 応答の構成（必ずこの順で）
1. 共感: ユーザーの気持ちを受け止める
2. 気づき: 下のデータから読み取れることを1つ伝える
3. 提案: 今週できる小さな具体的行動を1つだけ提案する

## 現在のポートフォリオ（過去30日）
${portfolio.breakdown.map((b) => `- ${b.categoryName}: ${b.percentage}%`).join('\n')}

## 心の柱: ${portfolio.pillars.count}本
${portfolio.pillars.items.map((p) => `- ${p.categoryName}（${p.stage === 'pillar' ? '柱' : p.stage === 'young' ? '若木' : '芽'}・週${p.weeklyFrequency}回）`).join('\n')}

## 充足度（過去30日合計）: ${portfolio.fulfillment.total}pt

## 最近の心の揺らぎ（直近14日）
${recentFluctuations.length > 0 ? recentFluctuations.map((f) => `- ${f.occurred_date}: ${f.name ?? '（カテゴリなし）'}・${f.magnitude}`).join('\n') : 'なし'}

${portfolio.suggestion.exists ? `## 育成提案: ${portfolio.suggestion.message}` : ''}

## ルール
- 200文字以内で簡潔に返答する
- 上のデータに含まれる事実のみに言及し、データにないこと（睡眠・食事・体調など）を推測して書かない
- 診断・医療的アドバイス・薬剤への言及をしない
- 「依存」という言葉を使わず、「柱を育てる」という表現を使う
- ユーザーが希死念慮・自傷をほのめかした場合は、助言をやめて共感を示し、専門の相談窓口（よりそいホットライン 0120-279-338 など）を案内する`;

    const messages = history
      .reverse()
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
    messages.push({ role: 'user', content: userMessage });

    return this.gemini.generate(systemPrompt, messages);
  }
}
