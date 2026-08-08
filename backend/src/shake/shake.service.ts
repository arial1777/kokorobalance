import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { ShakeTemplate } from './shake-template.entity';
import { ShakeEvent } from './shake-event.entity';
import { PrepAction } from './prep-action.entity';
import { ShakeReview } from './shake-review.entity';
import { Category } from '../categories/category.entity';
import { Profile } from '../profile/profile.entity';
import { CreateShakeEventDto } from './dto/create-shake-event.dto';
import { UpdateShakeEventDto } from './dto/update-shake-event.dto';
import { CreatePrepActionDto } from './dto/create-prep-action.dto';
import { CreateShakeReviewDto } from './dto/create-shake-review.dto';
import { SafetyService } from '../common/safety/safety.service';
import { HotlineView, SafetyVerdict } from '../common/safety/safety.types';
import { NotificationsService } from '../notifications/notifications.service';
import { GeminiService } from '../common/gemini.service';
import { PortfolioService, CategoryStage } from '../portfolio/portfolio.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { ShakeCategory, SupportListItem, SupportListSnapshot } from './shake.types';

const MAX_ACTIVE_EVENTS = 10;

export interface SaveShakeEventResult {
  event: ShakeEvent;
  safetyVerdict: SafetyVerdict;
  hotlines: HotlineView[];
}

export interface ShakeEventDetail {
  event: ShakeEvent;
  preps: PrepAction[];
  review: ShakeReview | null;
  hotlines: HotlineView[];
}

export interface SaveShakeReviewResult {
  review: ShakeReview;
  safetyVerdict: SafetyVerdict;
  hotlines: HotlineView[];
}

const CATEGORY_HINTS: Partial<Record<ShakeCategory, string>> = {
  oshi: '同じものを好きな人と、当日のあと話す約束をしてみる',
  work: '仕事の外にある予定を、当日の前後に入れてみる',
  exam: '結果を聞いたあと、最初に連絡する人を決めておく',
  health: '結果を聞いたあと、最初に連絡する人を決めておく',
  relationship: 'その人以外にも、話せる相手を一人思い出しておく',
};

@Injectable()
export class ShakeService {
  private readonly isStub: boolean;

  constructor(
    @InjectRepository(ShakeTemplate) private readonly templateRepo: Repository<ShakeTemplate>,
    @InjectRepository(ShakeEvent) private readonly eventRepo: Repository<ShakeEvent>,
    @InjectRepository(PrepAction) private readonly prepRepo: Repository<PrepAction>,
    @InjectRepository(ShakeReview) private readonly reviewRepo: Repository<ShakeReview>,
    @InjectRepository(Category) private readonly categoryRepo: Repository<Category>,
    @InjectRepository(Profile) private readonly profileRepo: Repository<Profile>,
    private readonly safety: SafetyService,
    private readonly notifications: NotificationsService,
    private readonly gemini: GeminiService,
    private readonly portfolio: PortfolioService,
    private readonly analytics: AnalyticsService,
    config: ConfigService,
  ) {
    this.isStub = config.get<string>('AI_STUB') !== 'false';
  }

  // ============================================================
  // テンプレート・一覧・詳細
  // ============================================================

  getTemplates(): Promise<ShakeTemplate[]> {
    return this.templateRepo.find({ where: { active: true }, order: { category: 'ASC', sortOrder: 'ASC' } });
  }

  getEvents(userId: string, status?: string): Promise<ShakeEvent[]> {
    return this.eventRepo.find({
      where: status ? { userId, status: status as ShakeEvent['status'] } : { userId },
      order: { eventDate: 'ASC' },
    });
  }

  async getEventDetail(userId: string, id: string): Promise<ShakeEventDetail> {
    const event = await this.assertOwnedEvent(userId, id);
    const preps = await this.prepRepo.find({
      where: { shakeEventId: id },
      relations: { category: true },
      order: { createdAt: 'ASC' },
    });
    const review = await this.reviewRepo.findOne({ where: { shakeEventId: id } });
    const hotlines = event.status === 'today' ? await this.safety.getHotlines(null) : [];
    return { event, preps, review, hotlines };
  }

  // ============================================================
  // 登録・更新・削除
  // ============================================================

  async createEvent(userId: string, dto: CreateShakeEventDto): Promise<SaveShakeEventResult> {
    const activeCount = await this.eventRepo.count({ where: { userId, status: In(['planned', 'prepping', 'today', 'passed']) } });
    if (activeCount >= MAX_ACTIVE_EVENTS) {
      throw new ForbiddenException('登録できる揺れそうな日は10件までです');
    }

    let title = dto.title;
    let expectedShake = dto.expectedShake;
    let category = dto.category;

    if (dto.templateKey) {
      const template = await this.templateRepo.findOne({ where: { templateKey: dto.templateKey, active: true } });
      if (!template) throw new NotFoundException('テンプレートが見つかりません');
      title = title ?? template.label;
      expectedShake = expectedShake ?? template.defaultExpectedShake;
      category = template.category;
    }
    if (!title) throw new ForbiddenException('タイトルを入力してください');
    if (!category) throw new ForbiddenException('カテゴリを選択してください');

    const isDateCertain = dto.isDateCertain ?? true;
    if (isDateCertain) {
      const today = this.jstToday();
      if (dto.eventDate < today) {
        throw new ForbiddenException('過去の日付は登録できません');
      }
    }

    if (dto.affectedCategoryIds?.length) {
      await this.assertCategoriesOwned(userId, dto.affectedCategoryIds);
    }

    const evaluation = await this.safety.evaluate(title, 'shake_event_title', userId);

    const event = await this.eventRepo.save(
      this.eventRepo.create({
        userId,
        title,
        templateKey: dto.templateKey ?? null,
        category,
        eventDate: dto.eventDate,
        isDateCertain,
        expectedShake: expectedShake ?? 2,
        durationDays: dto.durationDays ?? null,
        affectedCategoryIds: dto.affectedCategoryIds ?? [],
        status: 'planned',
      }),
    );

    // 11 §3.2 のファネル。タイトルは送らない（ME-01）
    await this.analytics.track(userId, 'shake_event_created', {
      category: event.category,
      expectedShake: event.expectedShake,
    });

    const hotlines = evaluation.verdict !== 'clear' ? await this.safety.getHotlines(evaluation.category) : [];
    return { event, safetyVerdict: evaluation.verdict, hotlines };
  }

  async updateEvent(userId: string, id: string, dto: UpdateShakeEventDto): Promise<ShakeEvent> {
    const event = await this.assertOwnedEvent(userId, id);
    if (dto.affectedCategoryIds?.length) {
      await this.assertCategoriesOwned(userId, dto.affectedCategoryIds);
    }
    if (dto.eventDate !== undefined) {
      // 日付が変わったら支えリストは破棄して再生成に任せる（05 §10 E-03）
      event.supportListSnapshot = null;
      event.supportListNotifiedAt = null;
    }
    Object.assign(event, {
      ...(dto.eventDate !== undefined && { eventDate: dto.eventDate }),
      ...(dto.isDateCertain !== undefined && { isDateCertain: dto.isDateCertain }),
      ...(dto.expectedShake !== undefined && { expectedShake: dto.expectedShake }),
      ...(dto.affectedCategoryIds !== undefined && { affectedCategoryIds: dto.affectedCategoryIds }),
      ...(dto.shareTitleWithPair !== undefined && { shareTitleWithPair: dto.shareTitleWithPair }),
    });
    return this.eventRepo.save(event);
  }

  async archiveEvent(userId: string, id: string): Promise<void> {
    const event = await this.assertOwnedEvent(userId, id);
    event.status = 'archived';
    await this.eventRepo.save(event);
  }

  // ============================================================
  // 備え
  // ============================================================

  async createUserPrep(userId: string, eventId: string, dto: CreatePrepActionDto): Promise<PrepAction> {
    const event = await this.assertOwnedEvent(userId, eventId);
    if (dto.categoryId) await this.assertCategoriesOwned(userId, [dto.categoryId]);
    return this.prepRepo.save(
      this.prepRepo.create({
        shakeEventId: event.id,
        categoryId: dto.categoryId ?? null,
        body: dto.body,
        source: 'user',
        dueDate: event.eventDate,
        state: 'suggested',
        stateChangedAt: new Date(),
      }),
    );
  }

  async acceptPrep(userId: string, eventId: string, prepId: string): Promise<PrepAction> {
    const event = await this.assertOwnedEvent(userId, eventId);
    const prep = await this.assertOwnedPrep(eventId, prepId);

    // 同時にacceptedは1件まで（05 §5.2）。既存acceptedはskippedへ
    await this.prepRepo.update(
      { shakeEventId: eventId, state: 'accepted' },
      { state: 'skipped', stateChangedAt: new Date() },
    );

    prep.state = 'accepted';
    prep.stateChangedAt = new Date();
    prep.dueDate = this.computeDueDate(event.eventDate);
    const accepted = await this.prepRepo.save(prep);
    // 備えの本文は送らない（ME-01）。提案元だけを見る
    await this.analytics.track(userId, 'prep_accepted', { source: prep.source });
    return accepted;
  }

  async completePrep(userId: string, eventId: string, prepId: string): Promise<PrepAction> {
    const event = await this.assertOwnedEvent(userId, eventId);
    const prep = await this.assertOwnedPrep(eventId, prepId);
    prep.state = 'done';
    prep.stateChangedAt = new Date();
    const saved = await this.prepRepo.save(prep);
    await this.analytics.track(userId, 'prep_done', { source: prep.source });

    // 次の備えを1件だけ、週1ペースで提案（05 §5.1）
    if (event.status === 'prepping') {
      await this.generateSingleFollowUpPrep(userId, event);
    }
    return saved;
  }

  async skipPrep(userId: string, eventId: string, prepId: string): Promise<PrepAction> {
    await this.assertOwnedEvent(userId, eventId);
    const prep = await this.assertOwnedPrep(eventId, prepId);
    prep.state = 'skipped';
    prep.stateChangedAt = new Date();
    return this.prepRepo.save(prep);
  }

  // ============================================================
  // ふりかえり
  // ============================================================

  async createReview(userId: string, eventId: string, dto: CreateShakeReviewDto): Promise<SaveShakeReviewResult> {
    const event = await this.assertOwnedEvent(userId, eventId);
    const existing = await this.reviewRepo.findOne({ where: { shakeEventId: eventId } });
    if (existing) throw new ForbiddenException('この揺れそうな日のふりかえりは既に記録されています');

    if (dto.helpedCategoryIds?.length) {
      await this.assertCategoriesOwned(userId, dto.helpedCategoryIds);
    }

    let safetyVerdict: SafetyVerdict = 'clear';
    let hotlines: HotlineView[] = [];
    if (dto.note) {
      const evaluation = await this.safety.evaluate(dto.note, 'shake_review_note', userId);
      safetyVerdict = evaluation.verdict;
      if (evaluation.verdict !== 'clear') hotlines = await this.safety.getHotlines(evaluation.category);
    }

    const review = await this.reviewRepo.save(
      this.reviewRepo.create({
        shakeEventId: eventId,
        feltShake: dto.feltShake,
        wasSupported: dto.wasSupported,
        helpedCategoryIds: dto.helpedCategoryIds ?? [],
        note: dto.note ?? null,
      }),
    );

    // ふりかえり完了で即archived（05 §3.1: passed → archived）
    event.status = 'archived';
    await this.eventRepo.save(event);

    // 北極星指標の元データ（11 §2）。メモは送らない（ME-01）
    await this.analytics.track(userId, 'shake_review_submitted', {
      wasSupported: review.wasSupported,
      feltShake: review.feltShake,
      expectedShake: event.expectedShake,
      category: event.category,
    });

    // ふりかえりの言語化（08-spec-companion.md §6、Pro限定）
    if (!this.isStub) {
      const profile = await this.profileRepo.findOne({ where: { id: userId } });
      if (profile?.plan === 'pro') {
        const aiReflection = await this.generateReviewReflection(event, review);
        if (aiReflection) {
          review.aiReflection = aiReflection;
          await this.reviewRepo.save(review);
        }
      }
    }

    return { review, safetyVerdict, hotlines };
  }

  // ============================================================
  // バッチ（毎時cron）
  // ============================================================

  async tick(): Promise<{ advanced: number; prepsGenerated: number; notified: number }> {
    let advanced = 0;
    let prepsGenerated = 0;
    let notified = 0;
    const today = this.jstToday();
    const hour = this.jstHour();

    // planned -> prepping（D-14、expected_shake=3はD-21）
    const plannedCertain = await this.eventRepo.find({ where: { status: 'planned', isDateCertain: true } });
    for (const event of plannedCertain) {
      const daysUntil = this.daysBetween(today, event.eventDate);
      const threshold = event.expectedShake === 3 ? 21 : 14;
      if (daysUntil <= threshold) {
        await this.generateInitialPreps(event.userId, event);
        prepsGenerated++;
        event.status = 'prepping';
        await this.eventRepo.save(event);
        advanced++;
        const sent = await this.notifications.notifyUser(
          event.userId,
          'shake_prep_suggested',
          'ココロバランス',
          `〈${event.title}〉まであと${daysUntil}日。ひとつだけ、備えを考えてみませんか`,
          { url: `/shake/${event.id}` },
        );
        if (sent) notified++;
      }
    }

    // 揺れの前の整理（D-3、Pro限定、08-spec-companion.md §6）
    if (!this.isStub) {
      const nearD3 = await this.eventRepo.find({
        where: { status: In(['prepping', 'today']), preReflectionGeneratedAt: IsNull() },
      });
      for (const event of nearD3) {
        if (this.daysBetween(today, event.eventDate) !== 3) continue;
        const profile = await this.profileRepo.findOne({ where: { id: event.userId } });
        if (profile?.plan !== 'pro') continue;
        const reflection = await this.generatePreReflection(event.userId, event);
        event.preReflectionGeneratedAt = new Date();
        if (reflection) event.preReflection = reflection;
        await this.eventRepo.save(event);
      }
    }

    // 支えリストのスナップショット確定（D-1、JST21時台）
    if (hour === 21) {
      const dayBefore = await this.eventRepo.find({
        where: { status: In(['prepping', 'today']), supportListNotifiedAt: IsNull() },
      });
      for (const event of dayBefore) {
        if (this.daysBetween(today, event.eventDate) === 1) {
          event.supportListSnapshot = await this.buildSupportListSnapshot(event.userId, event);
          event.supportListNotifiedAt = new Date();
          await this.eventRepo.save(event);
          const sent = await this.notifications.notifyUser(
            event.userId,
            'shake_tomorrow',
            'ココロバランス',
            `明日は〈${event.title}〉ですね。支えリストを用意しました`,
            { url: `/shake/${event.id}` },
          );
          if (sent) notified++;
        }
      }
    }

    // prepping/planned -> today（当日到達）
    const notYetToday = await this.eventRepo.find({ where: { status: In(['planned', 'prepping']) } });
    for (const event of notYetToday) {
      if (event.eventDate <= today) {
        if (!event.supportListSnapshot) {
          event.supportListSnapshot = await this.buildSupportListSnapshot(event.userId, event);
        }
        event.status = 'today';
        await this.eventRepo.save(event);
        advanced++;
      }
    }

    // today当日通知（JST8時台、未通知のみ）
    if (hour === 8) {
      const todayEvents = await this.eventRepo.find({ where: { status: 'today', todayNotifiedAt: IsNull() } });
      for (const event of todayEvents) {
        const sent = await this.notifications.notifyUser(
          event.userId,
          'shake_today',
          'ココロバランス',
          '今日です。あなたには他にこれがあります',
          { url: `/shake/${event.id}` },
        );
        event.todayNotifiedAt = new Date();
        await this.eventRepo.save(event);
        if (sent) notified++;
      }
    }

    // today -> passed（期間終了の翌日）
    const activeToday = await this.eventRepo.find({ where: { status: 'today' } });
    for (const event of activeToday) {
      const endDate = this.addDays(event.eventDate, event.durationDays ?? 0);
      if (this.daysBetween(endDate, today) >= 1) {
        event.status = 'passed';
        await this.eventRepo.save(event);
        advanced++;
      }
    }

    // ふりかえり通知（D+3、JST20時台）
    if (hour === 20) {
      const passedUnnotified = await this.eventRepo.find({ where: { status: 'passed', reviewNotifiedAt: IsNull() } });
      for (const event of passedUnnotified) {
        const endDate = this.addDays(event.eventDate, event.durationDays ?? 0);
        if (this.daysBetween(endDate, today) === 3) {
          const sent = await this.notifications.notifyUser(
            event.userId,
            'shake_review',
            'ココロバランス',
            `〈${event.title}〉から3日。どうでしたか？`,
            { url: `/shake/${event.id}` },
          );
          event.reviewNotifiedAt = new Date();
          await this.eventRepo.save(event);
          if (sent) notified++;
        }
      }
    }

    // passed -> archived（D+8、未ふりかえりでも自動アーカイブ。催促は既に1回のみ済）
    const stalePassed = await this.eventRepo.find({ where: { status: 'passed' } });
    for (const event of stalePassed) {
      const endDate = this.addDays(event.eventDate, event.durationDays ?? 0);
      if (this.daysBetween(endDate, today) >= 8) {
        event.status = 'archived';
        await this.eventRepo.save(event);
        advanced++;
      }
    }

    return { advanced, prepsGenerated, notified };
  }

  /** 揺れ当日中はFreeユーザーでも壁打ち無制限（05 §6.4 S-27） */
  async hasActiveEventToday(userId: string): Promise<boolean> {
    const count = await this.eventRepo.count({ where: { userId, status: 'today' } });
    return count > 0;
  }

  // ============================================================
  // 内部ヘルパー: 所有権
  // ============================================================

  private async assertOwnedEvent(userId: string, id: string): Promise<ShakeEvent> {
    const event = await this.eventRepo.findOne({ where: { id, userId } });
    if (!event) throw new NotFoundException('揺れそうな日が見つかりません');
    return event;
  }

  private async assertOwnedPrep(eventId: string, prepId: string): Promise<PrepAction> {
    const prep = await this.prepRepo.findOne({ where: { id: prepId, shakeEventId: eventId } });
    if (!prep) throw new NotFoundException('備えが見つかりません');
    return prep;
  }

  private async assertCategoriesOwned(userId: string, categoryIds: string[]): Promise<void> {
    const uniqueIds = Array.from(new Set(categoryIds));
    const owned = await this.categoryRepo.count({ where: { id: In(uniqueIds), userId } });
    if (owned !== uniqueIds.length) {
      throw new ForbiddenException('指定されたカテゴリが見つかりません');
    }
  }

  // ============================================================
  // 内部ヘルパー: 備えの生成
  // ============================================================

  private async generateInitialPreps(userId: string, event: ShakeEvent): Promise<void> {
    const stages = await this.portfolio.getCategoryStages(userId);
    const ruleCandidates = this.buildRuleCandidates(event, stages);
    const primary = ruleCandidates.slice(0, 2).map((c) => ({ ...c, source: 'rule' as const }));

    let third: { body: string; categoryId: string | null; source: 'rule' | 'ai' } | null = null;
    if (!this.isStub) {
      const profile = await this.profileRepo.findOne({ where: { id: userId } });
      if (profile?.plan === 'pro') {
        const aiCandidate = await this.generateAiCandidate(event);
        if (aiCandidate) third = { ...aiCandidate, source: 'ai' };
      }
    }
    if (!third && ruleCandidates[2]) third = { ...ruleCandidates[2], source: 'rule' };

    const finalCandidates = third ? [...primary, third] : primary;
    const now = new Date();
    const rows = finalCandidates.map((c) =>
      this.prepRepo.create({
        shakeEventId: event.id,
        categoryId: c.categoryId,
        body: c.body,
        source: c.source,
        dueDate: event.eventDate,
        state: 'suggested',
        stateChangedAt: now,
      }),
    );
    await this.prepRepo.save(rows);
  }

  private async generateSingleFollowUpPrep(userId: string, event: ShakeEvent): Promise<void> {
    const stages = await this.portfolio.getCategoryStages(userId);
    const usedBodies = new Set((await this.prepRepo.find({ where: { shakeEventId: event.id } })).map((p) => p.body));
    const candidates = this.buildRuleCandidates(event, stages).filter((c) => !usedBodies.has(c.body));
    const next = candidates[0];
    if (!next) return;
    await this.prepRepo.save(
      this.prepRepo.create({
        shakeEventId: event.id,
        categoryId: next.categoryId,
        body: next.body,
        source: 'rule',
        dueDate: event.eventDate,
        state: 'suggested',
        stateChangedAt: new Date(),
      }),
    );
  }

  /** 05 §5.3 のルールを、柱の型（07）に合わせたもの。必ず2件以上返す */
  private buildRuleCandidates(
    event: ShakeEvent,
    stages: Map<string, CategoryStage>,
  ): { body: string; categoryId: string | null }[] {
    const excluded = new Set(event.affectedCategoryIds);
    const eligible = [...stages.entries()].filter(([id]) => !excluded.has(id));
    const verified = eligible.filter(([, v]) => v.status === 'verified');
    const growing = eligible.filter(([, v]) => v.status === 'growing');
    const habits = eligible.filter(([, v]) => v.status === 'habit');

    const candidates: { body: string; categoryId: string | null }[] = [];
    if (verified.length > 0) {
      const [id, v] = verified[0];
      candidates.push({ body: `${v.name}に、この2週間で一度触れてみる`, categoryId: id });
    }
    // 育て中の柱（居場所・相手）を厚くする備えを優先し、無ければ習慣で代替する
    const nextToThicken = growing[0] ?? habits[0];
    if (nextToThicken) {
      const [id, v] = nextToThicken;
      candidates.push({ body: `${v.name}を、少し多めに使ってみる`, categoryId: id });
    }
    // 社会的な柱が薄いときは「居場所・相手を増やす」方向に促す（07 §1.2 の根拠がある軸）
    if (verified.length + growing.length <= 2) {
      candidates.push({ body: '人と会える場所を一つ、柱として登録してみる', categoryId: null });
    }
    const hint = CATEGORY_HINTS[event.category];
    if (hint) candidates.push({ body: hint, categoryId: null });
    candidates.push({ body: '当日の予定を、あえて何も入れないでおく', categoryId: null });

    const seen = new Set<string>();
    return candidates.filter((c) => (seen.has(c.body) ? false : (seen.add(c.body), true)));
  }

  private async generateAiCandidate(event: ShakeEvent): Promise<{ body: string; categoryId: string | null } | null> {
    try {
      const systemPrompt = `ユーザーが心の揺れに備えるための、具体的な行動を1つだけ提案してください。
60文字以内・日本語・「〜してみる」調で、出力は本文のみ(前置きや番号を付けない)。
数値・統計・パーセンテージへの言及は禁止。断定せず、選択肢の一つとして提示するトーンにすること。`;
      const raw = await this.gemini.generate(systemPrompt, [
        { role: 'user', content: `イベント: ${event.title}（カテゴリ: ${event.category}）` },
      ]);
      const body = raw.trim().replace(/^[・\-\d.\s"「」]+/, '').slice(0, 60);
      return body ? { body, categoryId: null } : null;
    } catch {
      return null;
    }
  }

  /** 揺れの前の整理（D-3、Pro限定）。過去のふりかえりを踏まえた400字以内の整理を生成する */
  private async generatePreReflection(userId: string, event: ShakeEvent): Promise<string | null> {
    try {
      const pastReviews = await this.reviewRepo
        .createQueryBuilder('r')
        .innerJoin(ShakeEvent, 'e', 'e.id = r.shakeEventId')
        .where('e.userId = :userId', { userId })
        .orderBy('r.createdAt', 'DESC')
        .take(3)
        .getMany();
      if (pastReviews.length === 0) return null;

      const categoryIds = [...new Set(pastReviews.flatMap((r) => r.helpedCategoryIds))];
      const categories = categoryIds.length ? await this.categoryRepo.find({ where: { id: In(categoryIds) } }) : [];
      const nameById = new Map(categories.map((c) => [c.id, c.name]));
      const lines = pastReviews.map((r) => {
        const names = r.helpedCategoryIds.map((id) => nameById.get(id)).filter((n): n is string => !!n);
        const label =
          r.wasSupported === 'yes' ? '支えられた' : r.wasSupported === 'partly' ? '少し支えられた' : '支えを感じられなかった';
        return `- ${label}${names.length > 0 ? `（効いたもの: ${names.join('・')}）` : ''}`;
      });

      const systemPrompt = `ユーザーはこれから「${event.title}」という揺れそうな日を迎えます。過去の似た場面でのふりかえりを踏まえて、心の準備になるような短い整理を書いてください。
400文字以内・日本語。助言や「〜すべき」という指示はしない。数値・統計・パーセンテージへの言及は禁止。事実を断定せず、寄り添うトーンで。出力は本文のみ。`;
      const raw = await this.gemini.generate(
        systemPrompt,
        [{ role: 'user', content: `過去のふりかえり:\n${lines.join('\n')}` }],
        { timeoutMs: 15000 },
      );
      const body = raw.trim().slice(0, 400);
      return body || null;
    } catch {
      return null;
    }
  }

  /** ふりかえりの言語化（Pro限定）。記録した内容を短い言葉で言語化する */
  private async generateReviewReflection(event: ShakeEvent, review: ShakeReview): Promise<string | null> {
    try {
      const categories = review.helpedCategoryIds.length
        ? await this.categoryRepo.find({ where: { id: In(review.helpedCategoryIds) } })
        : [];
      const names = categories.map((c) => c.name);
      const label =
        review.wasSupported === 'yes' ? '支えられた' : review.wasSupported === 'partly' ? '少し支えられた' : '支えを感じられなかった';
      const detail = `結果: ${label}${names.length ? `\n効いた支え: ${names.join('・')}` : ''}${review.note ? `\nメモ: ${review.note}` : ''}`;

      const systemPrompt = `ユーザーは「${event.title}」という揺れそうな日を経験し、ふりかえりを記録しました。その内容を、短い言葉でそっと言語化してください。
150文字以内・日本語。助言はしない。良い/悪いの評価・判定をしない。数値・統計・パーセンテージへの言及は禁止。出力は本文のみ。`;
      const raw = await this.gemini.generate(systemPrompt, [{ role: 'user', content: detail }], { timeoutMs: 15000 });
      const body = raw.trim().slice(0, 200);
      return body || null;
    } catch {
      return null;
    }
  }

  // ============================================================
  // 内部ヘルパー: 支えリスト
  // ============================================================

  private async buildSupportListSnapshot(userId: string, event: ShakeEvent): Promise<SupportListSnapshot> {
    const excluded = new Set(event.affectedCategoryIds);
    const stages = await this.portfolio.getCategoryStages(userId);
    const usable = [...stages.entries()].filter(([id]) => !excluded.has(id));

    // 確かな柱 → 育て中 → 習慣 の順。習慣も必ず当日の支えに含める（07 §2.2、P-A-03）
    const verifiedItems = usable.filter(([, v]) => v.status === 'verified').slice(0, 4);
    const growingItems = usable.filter(([, v]) => v.status === 'growing').slice(0, 2);
    const habitItems = usable.filter(([, v]) => v.status === 'habit').slice(0, 2);

    const headline: SupportListSnapshot['headline'] =
      verifiedItems.length >= 2 ? 'many' : verifiedItems.length === 1 ? 'one' : 'none';

    const toItem = ([, v]: [string, CategoryStage]): SupportListItem => ({ kind: 'category', label: v.name });

    if (headline === 'none') {
      // 確かな柱が0件: 断定的なリストは出さず、育て中と習慣だけを静かに示す（05 §6.5）
      return { headline, items: [...growingItems, ...habitItems].map(toItem) };
    }

    const doneItems = await this.prepRepo.find({ where: { shakeEventId: event.id, state: 'done' }, order: { stateChangedAt: 'DESC' } });
    const skippedItems = await this.prepRepo.find({ where: { shakeEventId: event.id, state: 'skipped' } });

    const items: SupportListItem[] = [
      ...doneItems.map((p): SupportListItem => ({ kind: 'done_prep', label: p.body, detail: '約束済み' })),
      ...verifiedItems.map(toItem),
      ...growingItems.map(toItem),
      ...habitItems.map(toItem),
      ...skippedItems.map((p): SupportListItem => ({ kind: 'skipped_prep', label: p.body })),
    ];
    return { headline, items };
  }

  private computeDueDate(eventDate: string): string {
    const today = this.jstToday();
    const weekLater = this.addDays(today, 7);
    const dayBeforeEvent = this.addDays(eventDate, -1);
    return weekLater < dayBeforeEvent ? weekLater : dayBeforeEvent > today ? dayBeforeEvent : today;
  }

  // ============================================================
  // 内部ヘルパー: 日付（JST固定）
  // ============================================================

  private jstToday(): string {
    return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date());
  }

  private jstHour(): number {
    return Number(
      new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tokyo', hour: 'numeric', hour12: false }).format(new Date()),
    );
  }

  private daysBetween(from: string, to: string): number {
    const a = new Date(`${from}T00:00:00Z`);
    const b = new Date(`${to}T00:00:00Z`);
    return Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
  }

  private addDays(date: string, days: number): string {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().split('T')[0];
  }
}
