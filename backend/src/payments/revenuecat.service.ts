import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { timingSafeEqual } from 'crypto';
import { Subscription } from './subscription.entity';
import { Profile } from '../profile/profile.entity';
import { AnalyticsService } from '../analytics/analytics.service';

/** RevenueCatダッシュボードのEntitlement識別子（mobile/lib/purchases.tsのPRO_ENTITLEMENT_IDと一致させる） */
const PRO_ENTITLEMENT_ID = 'pro';

const ACTIVE_EVENT_TYPES = new Set(['INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'PRODUCT_CHANGE', 'TRANSFER']);
// EXPIRATION: 期間満了。REFUND: Appleが返金しエンタイトルメントを即時剥奪した場合。どちらもPro解除する
const REVOKE_EVENT_TYPES = new Set(['EXPIRATION', 'REFUND']);
const BILLING_ISSUE_EVENT_TYPES = new Set(['BILLING_ISSUE']);

interface RevenuecatEvent {
  id: string;
  type: string;
  app_user_id: string;
  product_id?: string;
  entitlement_ids?: string[];
  period_type?: 'NORMAL' | 'TRIAL' | 'INTRO';
  purchased_at_ms?: number;
  expiration_at_ms?: number | null;
  original_transaction_id?: string;
  transaction_id?: string;
}

@Injectable()
export class RevenuecatService {
  private readonly webhookAuthToken: string;

  constructor(
    @InjectRepository(Subscription)
    private readonly subRepo: Repository<Subscription>,
    @InjectRepository(Profile)
    private readonly profileRepo: Repository<Profile>,
    private readonly analytics: AnalyticsService,
    config: ConfigService,
  ) {
    this.webhookAuthToken = config.get<string>('REVENUECAT_WEBHOOK_AUTH_TOKEN') ?? '';
  }

  private verifyAuth(authHeader: string | undefined): void {
    const expected = this.webhookAuthToken;
    const received = authHeader ?? '';
    const expectedBuf = Buffer.from(expected);
    const receivedBuf = Buffer.from(received);
    const valid =
      expected.length > 0 &&
      expectedBuf.length === receivedBuf.length &&
      timingSafeEqual(expectedBuf, receivedBuf);
    if (!valid) throw new UnauthorizedException();
  }

  async handleWebhook(body: { event?: RevenuecatEvent }, authHeader: string | undefined): Promise<void> {
    this.verifyAuth(authHeader);

    const event = body.event;
    if (!event?.app_user_id) return;
    // このEntitlement以外（将来別プランを追加した場合など）のイベントは無視
    if (event.entitlement_ids && !event.entitlement_ids.includes(PRO_ENTITLEMENT_ID)) return;

    if (ACTIVE_EVENT_TYPES.has(event.type)) {
      await this.upsertActive(event);
    } else if (BILLING_ISSUE_EVENT_TYPES.has(event.type)) {
      await this.markPastDue(event);
    } else if (REVOKE_EVENT_TYPES.has(event.type)) {
      await this.revokeAccess(event);
    }
    // CANCELLATION（自動更新オフ）は期間終了まで引き続きPro扱いのため何もしない
  }

  private originalTransactionId(event: RevenuecatEvent): string | undefined {
    return event.original_transaction_id ?? event.transaction_id;
  }

  private async findOrCreate(event: RevenuecatEvent): Promise<Subscription> {
    const originalTransactionId = this.originalTransactionId(event);
    // original_transaction_idが無いイベントは稀だが、その場合も同一ユーザーの既存revenuecat行を
    // 使い回す（さもないと配信のたびにsubscriptionsへ重複行ができてしまう）
    const existing = originalTransactionId
      ? await this.subRepo.findOne({ where: { revenuecatOriginalTransactionId: originalTransactionId } })
      : await this.subRepo.findOne({ where: { userId: event.app_user_id, provider: 'revenuecat' } });
    return (
      existing ??
      this.subRepo.create({
        userId: event.app_user_id,
        provider: 'revenuecat',
        revenuecatOriginalTransactionId: originalTransactionId ?? null,
        plan: 'pro',
      })
    );
  }

  private async upsertActive(event: RevenuecatEvent): Promise<void> {
    const record = await this.findOrCreate(event);
    record.revenuecatProductId = event.product_id ?? record.revenuecatProductId;
    record.status = event.period_type === 'TRIAL' ? 'trialing' : 'active';
    record.currentPeriodStart = event.purchased_at_ms ? new Date(event.purchased_at_ms) : record.currentPeriodStart;
    record.currentPeriodEnd = event.expiration_at_ms ? new Date(event.expiration_at_ms) : null;
    await this.subRepo.save(record);
    await this.profileRepo.update(event.app_user_id, { plan: 'pro' });
    await this.analytics.track(event.app_user_id, 'checkout_completed', {
      provider: 'revenuecat',
      eventType: event.type,
    });
  }

  private async markPastDue(event: RevenuecatEvent): Promise<void> {
    const record = await this.findOrCreate(event);
    record.status = 'past_due';
    await this.subRepo.save(record);
    // Appleの猶予期間中はエンタイトルメントが有効な可能性があるためplanは変更しない
  }

  private async revokeAccess(event: RevenuecatEvent): Promise<void> {
    const record = await this.findOrCreate(event);
    record.status = 'canceled';
    await this.subRepo.save(record);

    // Web(Stripe)側で別途アクティブな購読を持つ場合は無料に落とさない
    const stillActive = await this.subRepo.count({
      where: { userId: event.app_user_id, status: In(['active', 'trialing']) },
    });
    if (stillActive === 0) {
      await this.profileRepo.update(event.app_user_id, { plan: 'free' });
    }
  }
}
