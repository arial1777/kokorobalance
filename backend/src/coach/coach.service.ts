import { ForbiddenException, HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, MoreThanOrEqual, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { AiCoachMessage } from './ai-coach-message.entity';
import { AiUsage } from './ai-usage.entity';
import { PortfolioService } from '../portfolio/portfolio.service';
import { Profile } from '../profile/profile.entity';
import { GeminiService } from '../common/gemini.service';
import { SafetyService } from '../common/safety/safety.service';
import { HotlineView, SafetyVerdict } from '../common/safety/safety.types';
import { ShakeService } from '../shake/shake.service';
import { ResponseType, selectResponseType, violatesPolicy } from './response-policy';

/** Freeプランの日次往復上限（08-spec-companion.md §5.1、4時始まりでリセット） */
export const FREE_DAILY_LIMIT = 1;
/** Proプランの日次往復上限（コスト超過防止のためのソフトキャップ） */
export const PRO_DAILY_LIMIT = 100;

/** 生成に失敗した場合の固定応答（AI-23: 往復としてカウントしない） */
const GENERATION_FAILURE_REPLY = 'うまく言葉が出てきませんでした。もう一度送ってもらえますか。';

/** 後処理チェックに2回連続で失敗した場合の型Aフォールバック */
const POLICY_FALLBACK_REPLY = 'そうなんですね。話してくれてありがとうございます。';

const TYPE_INSTRUCTIONS: Record<ResponseType, string> = {
  A: '型A（受け止めるだけ）: 気持ちをそのまま受け止める言葉だけを返す。助言・行動提案・気づきの指摘はしない。',
  B: '型B（短い問い返し）: 気持ちを一度受け止めたうえで、もう少し聞かせてほしいという短い問いを1つだけ添える。',
  C: '型C（選択肢）: 気持ちを受け止めたうえで、今できそうな小さな行動の選択肢を2〜3個、決めつけずに並べる。どれを選ぶか・選ばないかはユーザーに委ねる。',
  D: '型D（揺れそうな日への言及）: 気持ちを受け止めたうえで、下記「近づいている揺れそうな日」に一度だけ、押しつけがましくなく触れてよい。この話題以外では揺れそうな日に触れない。',
};

export interface CoachQuota {
  plan: 'free' | 'pro';
  limit: number | null;
  used: number;
  remaining: number | null;
  /** 揺れ当日はFreeでも無制限（05-spec-shake-forecast.md §6.4 S-27） */
  isShakeToday: boolean;
}

export interface ChatResult {
  reply: string;
  messageId: string;
  /** @deprecated verdict === 'block' と同義。後方互換のため残す */
  crisis: boolean;
  verdict: SafetyVerdict;
  hotlines: HotlineView[];
}

const STUB_REPLIES = [
  'よく話してくれましたね。今日はそのことを聞かせてくれてありがとうございます。',
  'その気持ち、よくわかります。話してくれるだけで十分ですよ。',
  '教えてくれてありがとうございます。そう感じているのですね。',
  'なるほど、そう感じているのですね。もう少し聞かせてもらえますか？',
];

interface CoachContext {
  historyLength: number;
  messages: { role: 'user' | 'assistant'; content: string }[];
  previousAssistantText: string | null;
  threadSummary: string | null;
  categoryLines: string[];
  nearbyShake: { title: string; daysUntil: number } | null;
}

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
    private readonly safety: SafetyService,
    private readonly gemini: GeminiService,
    private readonly shake: ShakeService,
    private readonly config: ConfigService,
  ) {
    // AI_STUB を明示的に 'false' にした場合のみ実API呼び出しに切り替える(デフォルトは安全側でスタブ)
    this.isStub = config.get<string>('AI_STUB') !== 'false';
  }

  async getMessages(userId: string): Promise<AiCoachMessage[]> {
    const since = await this.threadSince(userId);
    return this.messageRepo.find({
      where: { userId, createdAt: MoreThanOrEqual(since) },
      order: { createdAt: 'ASC' },
      take: 50,
    });
  }

  /** 表示中スレッドを新規開始扱いにする（履歴はai_coach_messagesに残したまま、以降の取得だけリセットする） */
  async resetThread(userId: string): Promise<{ resetAt: string }> {
    const now = new Date();
    await this.profileRepo.update(userId, { coachThreadResetAt: now });
    return { resetAt: now.toISOString() };
  }

  /** 4時始まりの「今日」の開始時刻（UTC instant）。深夜〜3:59は前日のスレッドとして扱う */
  private activeDayBoundary(): Date {
    const shifted = new Date(Date.now() - 4 * 60 * 60 * 1000);
    const activeDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(shifted);
    return new Date(`${activeDate}T04:00:00+09:00`);
  }

  /** 表示・AIへの会話履歴に含める起点（日次の自動リセットと手動リセットの遅い方） */
  private async threadSince(userId: string): Promise<Date> {
    const boundary = this.activeDayBoundary();
    const profile = await this.profileRepo.findOne({ where: { id: userId } });
    const manualReset = profile?.coachThreadResetAt ?? null;
    return manualReset && manualReset > boundary ? manualReset : boundary;
  }

  async getQuota(userId: string): Promise<CoachQuota> {
    const profile = await this.profileRepo.findOne({ where: { id: userId } });
    const plan = profile?.plan ?? 'free';
    const used = await this.getDailyUsage(userId);
    const limit = plan === 'pro' ? PRO_DAILY_LIMIT : FREE_DAILY_LIMIT;
    const isShakeToday = plan !== 'pro' && (await this.shake.hasActiveEventToday(userId));
    return {
      plan,
      limit,
      used,
      remaining: Math.max(0, limit - used),
      isShakeToday,
    };
  }

  async chat(userId: string, userMessage: string): Promise<ChatResult> {
    const profile = await this.profileRepo.findOne({ where: { id: userId } });

    // AI送信への明示同意（v2 §7.3）。未同意なら 428 を返しフロントで同意を取る
    if (!profile?.aiConsentAt) {
      throw new HttpException('AI_CONSENT_REQUIRED', 428);
    }

    // セーフティ判定（03-spec-safety.md）。AIに送る前に必ず通す。
    // 日次枠を使い切っていてもここは必ず実行する（AI-22: 上限到達時でもセーフティ判定は動く）
    const evaluation = await this.safety.evaluate(userMessage, 'companion', userId);

    if (evaluation.verdict === 'block') {
      // block: AIには送らず固定応答＋窓口のみを返す。日次枠も消費しない
      const hotlines = await this.safety.getHotlines(evaluation.category);
      const reply = this.buildBlockReply();
      const messageId = await this.saveExchange(userId, userMessage, reply, 'block');
      return { reply, messageId, crisis: true, verdict: 'block', hotlines };
    }

    // 日次枠チェック（08 §5.1）。ただし揺れの当日はFreeユーザーでも無制限（05 §6.4 S-27）
    const isShakeToday = profile.plan !== 'pro' && (await this.shake.hasActiveEventToday(userId));
    if (!isShakeToday) {
      const limit = profile.plan === 'pro' ? PRO_DAILY_LIMIT : FREE_DAILY_LIMIT;
      const used = await this.getDailyUsage(userId);
      if (used >= limit) {
        throw new ForbiddenException('QUOTA_EXCEEDED');
      }
    }

    let reply: string;
    let generationFailed = false;
    if (this.isStub) {
      reply = this.stubReply();
    } else {
      try {
        reply = await this.generateReply(userId, userMessage, evaluation.verdict === 'caution');
      } catch {
        // タイムアウト・API障害など（08 §7）。往復としてカウントしない
        reply = GENERATION_FAILURE_REPLY;
        generationFailed = true;
      }
    }

    let hotlines: HotlineView[] = [];
    if (evaluation.verdict === 'caution') {
      hotlines = await this.safety.getHotlines(evaluation.category);
    }

    if (generationFailed) {
      return { reply, messageId: '', crisis: false, verdict: evaluation.verdict, hotlines };
    }

    const messageId = await this.saveExchange(userId, userMessage, reply, evaluation.verdict);
    await this.incrementUsage(userId);

    return { reply, messageId, crisis: false, verdict: evaluation.verdict, hotlines };
  }

  /** 「この返信は的外れ／つらかった」報告（03 §6.1 C）。全AI応答から呼べる */
  async reportOffBase(userId: string, messageId: string): Promise<void> {
    const message = await this.messageRepo.findOne({ where: { id: messageId, userId, role: 'assistant' } });
    if (!message) {
      throw new NotFoundException('メッセージが見つかりません');
    }
    await this.messageRepo.update(messageId, { reportedOffBaseAt: new Date() });
  }

  private buildBlockReply(): string {
    return [
      '話してくれてありがとうございます。いま、とてもつらい状況なのですね。あなたの気持ちはとても大切です。',
      '',
      '私はAIで、専門的な支援はできません。つらい気持ちが続くときは、ひとりで抱えずに、専門の相談窓口に話してみてください。',
    ].join('\n');
  }

  private async saveExchange(
    userId: string,
    userMessage: string,
    reply: string,
    verdict: SafetyVerdict,
  ): Promise<string> {
    const isCrisis = verdict === 'block';
    await this.messageRepo.save(
      this.messageRepo.create({ userId, role: 'user', content: userMessage, isCrisis, safetyVerdict: verdict }),
    );
    const assistant = await this.messageRepo.save(
      this.messageRepo.create({ userId, role: 'assistant', content: reply, isCrisis, safetyVerdict: verdict }),
    );
    return assistant.id;
  }

  private currentMonthJST(): string {
    return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' })
      .format(new Date())
      .slice(0, 7);
  }

  /** 日次枠の判定に使う「今日」の往復数（4時始まり境界、ユーザー発話の件数） */
  private async getDailyUsage(userId: string): Promise<number> {
    const boundary = this.activeDayBoundary();
    return this.messageRepo.count({
      where: { userId, role: 'user', createdAt: MoreThanOrEqual(boundary) },
    });
  }

  /** コスト把握のためProも含めて全ユーザーの月間利用回数を記録する（枠判定には使わない） */
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

  private daysBetween(from: string, to: string): number {
    const a = new Date(`${from}T00:00:00Z`);
    const b = new Date(`${to}T00:00:00Z`);
    return Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
  }

  private async buildContext(userId: string): Promise<CoachContext> {
    const since = await this.threadSince(userId);
    const history = await this.messageRepo.find({
      where: { userId, createdAt: MoreThanOrEqual(since) },
      order: { createdAt: 'DESC' },
      take: 10,
    });
    const previousAssistantText = history.find((m) => m.role === 'assistant')?.content ?? null;
    const messages = history
      .slice()
      .reverse()
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    // 柱は名前と状態（確かな柱/育て中/習慣）のみ渡す。数値（%・pt・本数）は渡さない（08 §4.4）
    const stages = await this.portfolioService.getCategoryStages(userId);
    const statusLabel = { verified: '確かな柱', growing: '育て中', habit: '習慣' } as const;
    const categoryLines = [...stages.values()].map((s) => `- ${s.name}（${statusLabel[s.status]}）`);

    // 揺れそうな日: タイトル・残り日数のみ（08 §4.4）
    const events = await this.shake.getEvents(userId);
    const todayJST = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date());
    let nearbyShake: CoachContext['nearbyShake'] = null;
    for (const e of events) {
      if (e.status === 'archived') continue;
      const daysUntil = this.daysBetween(todayJST, e.eventDate);
      if (daysUntil < 0 || daysUntil > 7) continue;
      if (!nearbyShake || daysUntil < nearbyShake.daysUntil) {
        nearbyShake = { title: e.title, daysUntil };
      }
    }

    const threadSummary = history.length === 0 ? await this.buildThreadSummary(userId, since) : null;

    return {
      historyLength: history.length,
      messages,
      previousAssistantText,
      threadSummary,
      categoryLines,
      nearbyShake,
    };
  }

  /**
   * 新しいスレッドの最初の発話時に、直近4週間・今回の境界より前の会話を500文字以内に要約する
   * （08 §4.4/4.5: リセット後も過去の要約は引き継がれる）。数値の統計は含めない。
   */
  private async buildThreadSummary(userId: string, before: Date): Promise<string | null> {
    if (this.isStub) return null;
    const fourWeeksAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
    if (fourWeeksAgo >= before) return null;

    const prior = await this.messageRepo.find({
      where: { userId, role: 'user', createdAt: Between(fourWeeksAgo, before) },
      order: { createdAt: 'DESC' },
      take: 20,
    });
    if (prior.length === 0) return null;

    const transcript = prior
      .slice()
      .reverse()
      .map((m) => `ユーザー: ${m.content}`)
      .join('\n');
    const summaryPrompt =
      '以下はユーザーが「壁打ち」機能で過去4週間に話した内容です。統計や数値は含めず、話題の流れだけを500文字以内の日本語で要約してください。判定や評価はしないでください。';

    try {
      return await this.gemini.generate(summaryPrompt, [{ role: 'user', content: transcript }], {
        timeoutMs: 8000,
      });
    } catch {
      return null;
    }
  }

  private buildSystemPrompt(ctx: CoachContext, responseType: ResponseType, caution: boolean): string {
    return `あなたは、ユーザーが考えを整理するための「壁打ち」相手です。日本語で応答してください。

## 応答の型
${TYPE_INSTRUCTIONS[responseType]}
${caution ? '\n今回のユーザー発話はつらさが強いと判定されています。型に関わらず、助言や提案はせず、共感と受け止めを優先してください。\n' : ''}
${ctx.threadSummary ? `## これまでの会話の要約\n${ctx.threadSummary}\n` : ''}
## いまの柱（カテゴリとステージ）
${ctx.categoryLines.length > 0 ? ctx.categoryLines.join('\n') : 'まだ記録がありません'}

${ctx.nearbyShake ? `## 近づいている揺れそうな日\n- ${ctx.nearbyShake.title}（あと${ctx.nearbyShake.daysUntil}日）\n` : ''}
## 守ること
- 200文字以内で簡潔に返答する
- パーセンテージ・回数・ポイント・本数などの数値を一切引用しない
- 「〜すべき」「〜してください」のような命令形は使わず、提案は「〜してみるのはどうでしょう」のような柔らかい言い方にとどめる
- ユーザーの選択や気持ちを否定しない。良い/悪いの評価をしない
- 「先週と比べて」のような週次の比較はしない
- 原因を勝手に推測して指摘しない（例: 「〜が原因かもしれません」と決めつけない）
- 病名・症状名・診断に類する言葉を使わない
- 自分（AI）の感情を主張しない（「私も嬉しいです」等は使わない）
- 直前の自分の発言と同じ言い回しを繰り返さない
- 「依存」という言葉を使わず、「柱を育てる」という表現を使う
- ユーザーが希死念慮・自傷をほのめかした場合は、助言をやめて共感を示し、専門の相談窓口（よりそいホットライン 0120-279-338 など）を案内する`;
  }

  private async generateReply(userId: string, userMessage: string, caution: boolean): Promise<string> {
    const ctx = await this.buildContext(userId);
    const responseType = caution ? 'A' : selectResponseType(userMessage, ctx.historyLength, !!ctx.nearbyShake);
    const systemPrompt = this.buildSystemPrompt(ctx, responseType, caution);
    const messages = [...ctx.messages, { role: 'user' as const, content: userMessage }];

    let reply = await this.gemini.generate(systemPrompt, messages, { timeoutMs: 15000 });
    if (violatesPolicy(reply, ctx.previousAssistantText)) {
      reply = await this.gemini.generate(systemPrompt, messages, { timeoutMs: 15000 });
      if (violatesPolicy(reply, ctx.previousAssistantText)) {
        reply = POLICY_FALLBACK_REPLY;
      }
    }
    return reply;
  }
}
