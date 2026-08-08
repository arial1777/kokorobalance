import { createHash } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GeminiMessage, GeminiService } from '../gemini.service';
import { SafetyRule } from './safety-rule.entity';
import { SafetyHotline } from './safety-hotline.entity';
import { SafetyEvent } from './safety-event.entity';
import { HotlineView, SafetyCategory, SafetyEvaluation, SafetySource, SafetyVerdict } from './safety.types';

const RULE_CACHE_TTL_MS = 5 * 60 * 1000;
const CLASSIFIER_TIMEOUT_MS = 2000;

/**
 * クライシス検知の二段判定（03-spec-safety.md）。
 * 第1段: DB管理の決定的ルール辞書（高再現率優先、誤検知は許容する）。
 * 第2段: ルール未ヒット時のみ、分類専用プロンプトでLLMを呼ぶ。
 *        タイムアウト・エラー時は caution にフォールバックする（clear にはしない）。
 */
@Injectable()
export class SafetyService {
  private readonly logger = new Logger(SafetyService.name);
  private readonly isStub: boolean;
  private ruleCache: { rules: SafetyRule[]; loadedAt: number } | null = null;

  constructor(
    @InjectRepository(SafetyRule) private readonly ruleRepo: Repository<SafetyRule>,
    @InjectRepository(SafetyHotline) private readonly hotlineRepo: Repository<SafetyHotline>,
    @InjectRepository(SafetyEvent) private readonly eventRepo: Repository<SafetyEvent>,
    private readonly gemini: GeminiService,
    config: ConfigService,
  ) {
    this.isStub = config.get<string>('AI_STUB') !== 'false';
  }

  /**
   * 自由記述テキストを判定する。matched_rules/本文ハッシュ付きで safety_events に記録する
   * （verdict='clear' は記録しない）。
   */
  async evaluate(text: string, source: SafetySource, userId: string): Promise<SafetyEvaluation> {
    const normalized = text.normalize('NFKC').toLowerCase();
    const rules = await this.getRules();

    const hit = rules.find((r) => normalized.includes(r.pattern.normalize('NFKC').toLowerCase()));
    if (hit) {
      const evaluation: SafetyEvaluation = {
        verdict: hit.verdict as SafetyVerdict,
        category: hit.category as SafetyCategory,
        matchedRuleIds: [hit.ruleId],
      };
      await this.recordEvent(userId, source, evaluation, text);
      return evaluation;
    }

    const classified = await this.classify(text);
    if (classified.verdict === 'clear') {
      return { verdict: 'clear', category: null, matchedRuleIds: [] };
    }
    const evaluation: SafetyEvaluation = {
      verdict: classified.verdict,
      category: classified.category,
      matchedRuleIds: [],
    };
    await this.recordEvent(userId, source, evaluation, text);
    return evaluation;
  }

  /** カテゴリ別 + 深夜は24時間対応を上位にした窓口一覧（03 §5.1/5.2）。 */
  async getHotlines(category: SafetyCategory | null, nowJst: Date = new Date()): Promise<HotlineView[]> {
    const rows = await this.hotlineRepo.find({
      where: { category: category ?? 'general', active: true },
      order: { sortOrder: 'ASC' },
    });
    const list = rows.length > 0
      ? rows
      : await this.hotlineRepo.find({ where: { category: 'general', active: true }, order: { sortOrder: 'ASC' } });

    const hourJst = Number(
      new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tokyo', hour: 'numeric', hour12: false }).format(nowJst),
    );
    const isLateNight = hourJst >= 22 || hourJst < 8;

    const sorted = [...list].sort((a, b) => {
      if (isLateNight && a.available24h !== b.available24h) return a.available24h ? -1 : 1;
      return a.sortOrder - b.sortOrder;
    });

    return sorted.map((h) => ({
      category: h.category,
      name: h.name,
      phone: h.phone,
      hoursText: h.hoursText,
      available24h: h.available24h,
      url: h.url,
    }));
  }

  private async getRules(): Promise<SafetyRule[]> {
    if (this.ruleCache && Date.now() - this.ruleCache.loadedAt < RULE_CACHE_TTL_MS) {
      return this.ruleCache.rules;
    }
    const rules = await this.ruleRepo.find({ where: { active: true } });
    this.ruleCache = { rules, loadedAt: Date.now() };
    return rules;
  }

  /**
   * 分類専用のLLM呼び出し。出力は {verdict, category, confidence} のJSONのみ。
   * タイムアウト・エラー・パース失敗はすべて caution にフォールバックする。
   */
  private async classify(text: string): Promise<{ verdict: SafetyVerdict; category: SafetyCategory | null }> {
    if (this.isStub) {
      return { verdict: 'clear', category: null };
    }

    const systemPrompt = `あなたはメンタルヘルスアプリの安全性分類器です。ユーザーの入力文を読み、以下のJSON形式のみで出力してください。他の文章は一切出力しないでください。

{"verdict": "clear"|"caution"|"block", "category": "suicide"|"self_harm"|"harm_to_others"|"abuse"|"eating_disorder"|"substance"|"distress"|null}

判定基準:
- block: 自殺念慮・自傷・他害・DV/虐待の被害示唆など、切迫した危機のシグナルが明確
- caution: つらさや絶望感が強いが、切迫した危機の明示はない（摂食障害の危険な行動・依存物質の危険な使用を含む）
- clear: 上記のいずれでもない

迷ったら caution 以上を選んでください（見逃しより過剰検知を許容します）。categoryはblock/cautionのときのみ設定し、clearならnullにしてください。`;

    const messages: GeminiMessage[] = [{ role: 'user', content: text }];

    try {
      const raw = await this.gemini.generate(systemPrompt, messages, {
        responseMimeType: 'application/json',
        timeoutMs: CLASSIFIER_TIMEOUT_MS,
      });
      const parsed = JSON.parse(raw) as { verdict?: string; category?: string | null };
      if (parsed.verdict === 'clear' || parsed.verdict === 'caution' || parsed.verdict === 'block') {
        return {
          verdict: parsed.verdict,
          category: (parsed.category as SafetyCategory) ?? null,
        };
      }
      this.logger.warn(`分類器の出力が不正です: ${raw}`);
      return { verdict: 'caution', category: 'distress' };
    } catch (e) {
      this.logger.warn(`分類器の呼び出しに失敗しました。cautionにフォールバックします: ${String(e)}`);
      return { verdict: 'caution', category: 'distress' };
    }
  }

  private async recordEvent(
    userId: string,
    source: SafetySource,
    evaluation: SafetyEvaluation,
    rawText: string,
  ): Promise<void> {
    if (evaluation.verdict === 'clear') return;
    await this.eventRepo.save(
      this.eventRepo.create({
        userId,
        source,
        verdict: evaluation.verdict,
        category: evaluation.category,
        matchedRules: evaluation.matchedRuleIds,
        actionTaken: evaluation.verdict === 'block' ? 'withheld_and_referred' : 'appended_referral',
        rawExcerptHash: createHash('sha256').update(rawText).digest('hex'),
      }),
    );
  }
}
