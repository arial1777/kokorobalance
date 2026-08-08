import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Not, Repository } from 'typeorm';
import { randomInt } from 'crypto';
import { Pair } from './pair.entity';
import { PillarVerificationRequest } from './pillar-verification-request.entity';
import { Category } from '../categories/category.entity';
import { Profile } from '../profile/profile.entity';
import { PortfolioService } from '../portfolio/portfolio.service';
import { PillarsService } from '../categories/pillars.service';
import { SafetyService } from '../common/safety/safety.service';
import { NotificationsService } from '../notifications/notifications.service';
import { HotlineView, SafetyVerdict } from '../common/safety/safety.types';
import {
  IncomingRequestView,
  OutgoingRequestView,
  PairView,
  PartnerView,
  PillarSlot,
  VerificationRequestAnswer,
} from './pair.types';

/** 招待コードの有効期限（§4.1） */
const INVITE_TTL_DAYS = 7;
/** 承認依頼が無反応のまま取り下げられるまで（E-03） */
const REQUEST_TTL_DAYS = 7;
/** 解消後、同じ相手と再びペアになれるまで（PR-09） */
const REPAIR_COOLDOWN_DAYS = 7;
/** 柱の色スロットの固定長。本数を数えられる形にしない（PR-A-12） */
const PILLAR_SLOT_COUNT = 5;
/** 色つきで見せる確かな柱の上限（§2.3） */
const MAX_VERIFIED_SLOTS = 3;

/** 紛らわしい文字（0/O/1/I/L）を除いた招待コードの文字種 */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

export interface RequestVerificationResult {
  requested: boolean;
  safetyVerdict: SafetyVerdict;
  hotlines: HotlineView[];
}

@Injectable()
export class PairService {
  constructor(
    @InjectRepository(Pair) private readonly pairRepo: Repository<Pair>,
    @InjectRepository(PillarVerificationRequest)
    private readonly requestRepo: Repository<PillarVerificationRequest>,
    @InjectRepository(Category) private readonly categoryRepo: Repository<Category>,
    @InjectRepository(Profile) private readonly profileRepo: Repository<Profile>,
    @InjectDataSource() private readonly ds: DataSource,
    private readonly portfolio: PortfolioService,
    private readonly pillars: PillarsService,
    private readonly safety: SafetyService,
    private readonly notifications: NotificationsService,
  ) {}

  // ============================================================
  // 招待・受諾
  // ============================================================

  async createInvite(userId: string): Promise<{ code: string; expiresAt: string }> {
    await this.expireStaleInvites();

    const existingPair = await this.findLivePair(userId);
    if (existingPair && existingPair.state !== 'invited') {
      throw new ForbiddenException('すでにペアがいます');
    }
    // PR-02: 未受諾の招待は作り直さず既存を返す
    if (existingPair?.state === 'invited' && existingPair.inviteCode && existingPair.inviteExpiresAt) {
      return { code: existingPair.inviteCode, expiresAt: existingPair.inviteExpiresAt.toISOString() };
    }

    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
    // 一意制約に当たったら引き直す
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = this.generateCode();
      try {
        const pair = await this.pairRepo.save(
          this.pairRepo.create({ userAId: userId, inviteCode: code, inviteExpiresAt: expiresAt, state: 'invited' }),
        );
        await this.log(userId, 'pair_invited');
        return { code: pair.inviteCode!, expiresAt: expiresAt.toISOString() };
      } catch (e) {
        if (attempt === 4) throw e;
      }
    }
    throw new BadRequestException('招待コードを作成できませんでした');
  }

  async revokeInvite(userId: string): Promise<void> {
    await this.pairRepo.update(
      { userAId: userId, state: 'invited' },
      { state: 'ended', endedAt: new Date(), inviteCode: null },
    );
  }

  async acceptInvite(userId: string, code: string): Promise<void> {
    await this.expireStaleInvites();

    const pair = await this.pairRepo.findOne({ where: { inviteCode: code.trim().toUpperCase(), state: 'invited' } });
    if (!pair) {
      throw new NotFoundException('このコードは使えなくなっています');
    }
    if (pair.userAId === userId) {
      throw new BadRequestException('自分の招待コードは使えません');
    }
    if (await this.findLivePair(userId)) {
      throw new ForbiddenException('すでにペアがいます');
    }
    // E-02: 相手が既に別のペアを持っている。**相手が誰かは伝えない**
    const inviterPair = await this.findLivePair(pair.userAId, pair.id);
    if (inviterPair) {
      throw new ForbiddenException('相手はすでに別の方とペアになっています');
    }
    // PR-09: 同じ相手との再ペアは解消から7日あける
    const cooldown = new Date(Date.now() - REPAIR_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
    const recentlyEnded = await this.ds.query<{ id: string }[]>(
      `SELECT id FROM pairs
        WHERE state = 'ended' AND ended_at IS NOT NULL AND ended_at > $3
          AND ((user_a_id = $1 AND user_b_id = $2) OR (user_a_id = $2 AND user_b_id = $1))
        LIMIT 1`,
      [userId, pair.userAId, cooldown],
    );
    if (recentlyEnded.length > 0) {
      throw new ForbiddenException('この相手とは、解消から7日たってから再開できます');
    }

    pair.userBId = userId;
    pair.state = 'active';
    pair.activatedAt = new Date();
    pair.inviteCode = null;
    pair.inviteExpiresAt = null;
    await this.pairRepo.save(pair);
    await this.log(userId, 'pair_activated');

    const accepter = await this.profileRepo.findOne({ where: { id: userId } });
    await this.notifications.notifyUser(
      pair.userAId,
      'pair_activated',
      'ココロバランス',
      `${accepter?.nickname ?? 'お相手'}さんとペアになりました`,
      { url: '/settings/pair' },
    );
  }

  // ============================================================
  // 共有ビュー（共有情報の境界はここだけで決める）
  // ============================================================

  /**
   * ペアの相手について共有する情報を組み立てる（09-spec-pair.md §2.1）。
   *
   * **柱のラベル・本数・構成比・mood_note・ふりかえりのメモ・壁打ちの内容・
   * セーフティ検知の事実は、いかなる場合も含めない**（§2.2、PR-A-03/PR-A-09）。
   * 承認依頼の柱ラベルだけが唯一の例外で、依頼者が明示的に送ったものに限る（§3.1）。
   */
  async getPairView(userId: string): Promise<PairView> {
    await this.expireStaleInvites();
    await this.withdrawStaleRequests();

    const pair = await this.findLivePair(userId);
    const empty: PairView = {
      state: null,
      invite: null,
      partner: null,
      incomingRequests: [],
      outgoingRequests: [],
    };
    if (!pair) return empty;

    if (pair.state === 'invited') {
      return {
        ...empty,
        state: 'invited',
        invite:
          pair.inviteCode && pair.inviteExpiresAt
            ? { code: pair.inviteCode, expiresAt: pair.inviteExpiresAt.toISOString() }
            : null,
      };
    }

    // 一時停止中は共有を止める（PR-08）
    if (pair.state === 'paused') {
      return { ...empty, state: 'paused' };
    }

    const partnerId = pair.userAId === userId ? pair.userBId! : pair.userAId;
    const partner = await this.buildPartnerView(partnerId);

    const requests = await this.requestRepo.find({
      where: { pairId: pair.id, state: In(['pending', 'answered']) },
      relations: { category: true },
      order: { createdAt: 'DESC' },
    });

    const incoming: IncomingRequestView[] = [];
    for (const r of requests) {
      if (r.requesterId === userId || r.state !== 'pending') continue;
      const requester = await this.profileRepo.findOne({ where: { id: r.requesterId } });
      incoming.push({
        id: r.id,
        // §3.1 の明示的な例外: 依頼された柱のラベルだけは相手に見える
        pillarLabel: r.category.name,
        requesterName: requester?.nickname ?? 'お相手',
        createdAt: r.createdAt.toISOString(),
      });
    }

    // 依頼者には「見た」ことしか返さない。answer は載せない（PR-A-05）
    const outgoing: OutgoingRequestView[] = requests
      .filter((r) => r.requesterId === userId)
      .map((r) => ({
        id: r.id,
        categoryId: r.categoryId,
        categoryName: r.category.name,
        state: r.state === 'answered' ? ('seen' as const) : ('pending' as const),
      }));

    return { state: 'active', invite: null, partner, incomingRequests: incoming, outgoingRequests: outgoing };
  }

  private async buildPartnerView(partnerId: string): Promise<PartnerView> {
    const profile = await this.profileRepo.findOne({ where: { id: partnerId } });

    const weekStart = this.currentMondayJST();
    const checked = await this.ds.query<{ id: string }[]>(
      `SELECT id FROM weekly_checks WHERE user_id = $1 AND week_start = $2 LIMIT 1`,
      [partnerId, weekStart],
    );

    const stages = await this.portfolio.getCategoryStages(partnerId);
    const verified = [...stages.values()].filter((s) => s.status === 'verified');
    const growing = [...stages.values()].filter((s) => s.status === 'growing');

    // 確かな柱の色を最大3つ、残りを育て中の白丸で埋め、常に5個で固定する（PR-A-12）
    const slots: PillarSlot[] = [];
    for (const s of verified.slice(0, MAX_VERIFIED_SLOTS)) {
      slots.push({ kind: 'verified', color: s.color });
    }
    for (let i = 0; i < growing.length && slots.length < PILLAR_SLOT_COUNT; i++) {
      slots.push({ kind: 'growing' });
    }
    while (slots.length < PILLAR_SLOT_COUNT) slots.push({ kind: 'empty' });

    // 揺れそうな日は「日付が近いこと」だけを共有する。タイトルは明示的に共有を選んだときのみ
    const today = this.todayJST();
    const [shake] = await this.ds.query<{ event_date: string; title: string; share_title_with_pair: boolean }[]>(
      `SELECT event_date::text AS event_date, title, share_title_with_pair
         FROM shake_events
        WHERE user_id = $1 AND status IN ('planned', 'prepping', 'today')
          AND is_date_certain = true AND event_date >= $2
        ORDER BY event_date ASC LIMIT 1`,
      [partnerId, today],
    );

    return {
      displayName: profile?.nickname ?? 'お相手',
      checkedThisWeek: checked.length > 0,
      pillarSlots: slots,
      upcomingShake: shake
        ? { eventDate: shake.event_date, title: shake.share_title_with_pair ? shake.title : null }
        : null,
    };
  }

  // ============================================================
  // 一時停止・解消
  // ============================================================

  async pause(userId: string): Promise<void> {
    const pair = await this.requireActivePair(userId, ['active']);
    pair.state = 'paused';
    await this.pairRepo.save(pair);
  }

  async resume(userId: string): Promise<void> {
    const pair = await this.requireActivePair(userId, ['paused']);
    pair.state = 'active';
    await this.pairRepo.save(pair);
  }

  /** どちらからでも、いつでも、理由なく解消できる（PR-04）。相手には理由を伝えない（PR-05） */
  async end(userId: string): Promise<void> {
    const pair = await this.requireActivePair(userId, ['active', 'paused']);
    const partnerId = pair.userAId === userId ? pair.userBId : pair.userAId;

    await this.endPair(pair);
    if (partnerId) {
      await this.notifications.notifyUser(
        partnerId,
        'pair_ended',
        'ココロバランス',
        'ペアが解消されました',
        { url: '/settings/pair' },
      );
    }
    await this.log(userId, 'pair_ended');
  }

  /**
   * ペアを終了し、pair 由来の承認を 07 §3.4 の規則で処理する（PR-07）。
   * recurring_check の条件を満たしていれば再計算で自動的に復帰し、満たさなければ育て中に戻る。
   * **降格は通知しない**（E-05）。退会処理からも使う。
   */
  async endPair(pair: Pair): Promise<void> {
    pair.state = 'ended';
    pair.endedAt = new Date();
    pair.inviteCode = null;
    await this.pairRepo.save(pair);

    const weekStart = this.currentMondayJST();
    for (const uid of [pair.userAId, pair.userBId]) {
      if (!uid) continue;
      await this.pillars.reevaluateAfterPairEnded(uid, weekStart);
    }
  }

  /** 退会時に呼ぶ（E-04）。相手には「ペアが解消されました」だけを伝え、退会の事実は伝えない */
  async endPairsForDeletedUser(userId: string): Promise<void> {
    const pair = await this.findLivePair(userId);
    if (!pair) return;
    const partnerId = pair.userAId === userId ? pair.userBId : pair.userAId;

    await this.endPair(pair);
    if (partnerId) {
      await this.notifications.notifyUser(
        partnerId,
        'pair_ended',
        'ココロバランス',
        'ペアが解消されました',
        { url: '/settings/pair' },
      );
    }
  }

  // ============================================================
  // 承認
  // ============================================================

  async requestVerification(userId: string, categoryId: string): Promise<RequestVerificationResult> {
    const pair = await this.requireActivePair(userId, ['active']);

    const category = await this.categoryRepo.findOne({ where: { id: categoryId, userId } });
    if (!category) throw new NotFoundException('柱が見つかりません');
    if (category.kind === 'habit') {
      throw new BadRequestException('習慣は承認の対象ではありません');
    }
    if (category.verifiedAt) {
      throw new BadRequestException('すでに確かな柱です');
    }

    // E-07: ラベルにセーフティ検知語があれば依頼を送らず窓口を返す
    const evaluation = await this.safety.evaluate(category.name, 'pillar_label', userId);
    if (evaluation.verdict === 'block') {
      const hotlines = await this.safety.getHotlines(evaluation.category);
      return { requested: false, safetyVerdict: 'block', hotlines };
    }

    const existing = await this.requestRepo.findOne({ where: { categoryId, state: 'pending' } });
    if (!existing) {
      await this.requestRepo.save(
        this.requestRepo.create({ pairId: pair.id, categoryId, requesterId: userId, state: 'pending' }),
      );
      await this.log(userId, 'pair_verification_requested');

      const partnerId = pair.userAId === userId ? pair.userBId : pair.userAId;
      if (partnerId) {
        await this.notifications.notifyUser(
          partnerId,
          'pair_verification_requested',
          'ココロバランス',
          '承認してほしい柱があります',
          { url: '/settings/pair' },
        );
      }
    }
    return { requested: true, safetyVerdict: evaluation.verdict, hotlines: [] };
  }

  /**
   * 承認に答える（§3.2）。
   * `known` なら柱が確かな柱になり、依頼者へ N-07 を送る。
   * `unsure` でも状態は「見た」になるだけで、**「知らない」とは決して伝えない**（PR-A-05）。
   */
  async respondToRequest(userId: string, requestId: string, answer: VerificationRequestAnswer): Promise<void> {
    const request = await this.requestRepo.findOne({
      where: { id: requestId, state: 'pending' },
      relations: { category: true, pair: true },
    });
    if (!request) throw new NotFoundException('依頼が見つかりません');
    // 依頼された側だけが答えられる
    const pair = request.pair;
    const isMember = pair.userAId === userId || pair.userBId === userId;
    if (!isMember || request.requesterId === userId || pair.state !== 'active') {
      throw new NotFoundException('依頼が見つかりません');
    }

    request.state = 'answered';
    request.answer = answer;
    request.respondedAt = new Date();
    await this.requestRepo.save(request);
    await this.log(userId, 'pair_verification_answered');

    if (answer !== 'known') return;

    await this.categoryRepo.update(request.categoryId, {
      verifiedAt: new Date(),
      verificationSource: 'pair',
    });
    // 11 §5「承認経路の内訳」。依頼者側の柱が承認された事実だけを記録する（ラベルは送らない）
    await this.log(request.requesterId, 'pillar_verified');

    const responder = await this.profileRepo.findOne({ where: { id: userId } });
    // N-07。祝いすぎず、静かな一文にとどめる（§3.3）
    await this.notifications.notifyUser(
      request.requesterId,
      'pair_verified',
      'ココロバランス',
      `${responder?.nickname ?? 'お相手'}さんが、あなたの〈${request.category.name}〉を知っていると答えました。確かな柱になりました。`,
      { url: '/settings/pair' },
    );
  }

  // ============================================================
  // 内部ヘルパー
  // ============================================================

  /** 終了していないペア（invited/active/paused）を返す */
  private async findLivePair(userId: string, excludeId?: string): Promise<Pair | null> {
    const rows = await this.ds.query<{ id: string }[]>(
      `SELECT id FROM pairs
        WHERE state <> 'ended'
          AND (user_a_id = $1 OR user_b_id = $1)
          AND ($2::uuid IS NULL OR id <> $2::uuid)
        ORDER BY created_at DESC LIMIT 1`,
      [userId, excludeId ?? null],
    );
    if (rows.length === 0) return null;
    return this.pairRepo.findOne({ where: { id: rows[0].id } });
  }

  private async requireActivePair(userId: string, states: Pair['state'][]): Promise<Pair> {
    const pair = await this.findLivePair(userId);
    if (!pair || !states.includes(pair.state)) {
      throw new NotFoundException('ペアが見つかりません');
    }
    return pair;
  }

  /** 期限切れの招待を閉じる（E-01）。cronを持たず読み取り時に評価する */
  private async expireStaleInvites(): Promise<void> {
    await this.ds.query(
      `UPDATE pairs SET state = 'ended', ended_at = now(), invite_code = NULL
        WHERE state = 'invited' AND invite_expires_at IS NOT NULL AND invite_expires_at < now()`,
    );
  }

  /** 7日反応がない依頼を静かに取り下げる。依頼者に「無視された」とは伝えない（E-03） */
  private async withdrawStaleRequests(): Promise<void> {
    await this.ds.query(
      `UPDATE pillar_verification_requests SET state = 'withdrawn'
        WHERE state = 'pending' AND created_at < now() - ($1 || ' days')::INTERVAL`,
      [REQUEST_TTL_DAYS],
    );
  }

  private generateCode(): string {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
    }
    return code;
  }

  private async log(userId: string, eventName: string): Promise<void> {
    await this.ds.query(`INSERT INTO event_logs (user_id, event_name) VALUES ($1, $2)`, [userId, eventName]);
  }

  private todayJST(): string {
    return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date());
  }

  private currentMondayJST(): string {
    const d = new Date(`${this.todayJST()}T00:00:00Z`);
    const day = d.getUTCDay();
    d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day));
    return d.toISOString().split('T')[0];
  }
}
