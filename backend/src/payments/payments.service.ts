import { BadRequestException, Injectable } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Stripe from 'stripe';
import { Request } from 'express';
import { Subscription } from './subscription.entity';
import { Profile } from '../profile/profile.entity';
import { AnalyticsService } from '../analytics/analytics.service';

/** 課金の期間（10-pricing-b2b.md §2.2 案A: 月額¥330据え置き＋年額¥2,980追加） */
export type PlanInterval = 'month' | 'annual';

@Injectable()
export class PaymentsService {
  private readonly stripe: Stripe;
  private readonly monthlyPriceId: string;
  private readonly annualPriceId: string;

  constructor(
    @InjectRepository(Subscription)
    private readonly subRepo: Repository<Subscription>,
    @InjectRepository(Profile)
    private readonly profileRepo: Repository<Profile>,
    private readonly analytics: AnalyticsService,
    config: ConfigService,
  ) {
    this.stripe = new Stripe(config.get<string>('STRIPE_SECRET_KEY')!);
    this.monthlyPriceId = config.get<string>('STRIPE_PRO_PRICE_ID') ?? '';
    this.annualPriceId = config.get<string>('STRIPE_PRO_ANNUAL_PRICE_ID') ?? '';
  }

  /**
   * 購入できるプランを返す。年額のPriceが未設定なら年額導線を出さない。
   * 380日継続率は年額19.9% vs 月額14.2%（E-13）なので年額を既定にする（M-A-01）。
   */
  getPlans(): { intervals: PlanInterval[]; defaultInterval: PlanInterval } {
    const intervals: PlanInterval[] = [];
    if (this.annualPriceId) intervals.push('annual');
    if (this.monthlyPriceId) intervals.push('month');
    return { intervals, defaultInterval: intervals[0] ?? 'month' };
  }

  async createCheckoutSession(
    userId: string,
    email: string,
    interval?: PlanInterval,
  ): Promise<{ url: string }> {
    // 省略時は年額を既定にする（年額主導線）
    const resolved = interval ?? this.getPlans().defaultInterval;
    const price = resolved === 'annual' ? this.annualPriceId : this.monthlyPriceId;
    if (!price) {
      throw new BadRequestException('このプランは現在購入できません');
    }

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [{ price, quantity: 1 }],
      success_url: `${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/pricing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/pricing`,
      metadata: { userId, interval: resolved },
    });
    return { url: session.url! };
  }

  async createPortalSession(userId: string): Promise<{ url: string }> {
    const sub = await this.subRepo.findOne({ where: { userId } });
    const session = await this.stripe.billingPortal.sessions.create({
      customer: sub?.stripeCustomerId ?? '',
      return_url: `${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/settings/account`,
    });
    return { url: session.url };
  }

  /**
   * アカウント削除時にStripe側のサブスクリプションも解約する。
   * これを呼ばずにプロフィールを消すと、DB上の購読記録は消えても
   * Stripe側の課金は解約されず走り続けてしまう。
   * RevenueCat(Apple IAP)経由の購読はApple側の仕様上サーバーから解約できないため対象外
   * （ユーザーがApple IDの「サブスクリプション」から解約する必要がある）。
   */
  async cancelSubscriptionForDeletedUser(userId: string): Promise<void> {
    const sub = await this.subRepo.findOne({ where: { userId, provider: 'stripe' } });
    if (!sub || sub.status === 'canceled' || !sub.stripeSubscriptionId) return;
    try {
      await this.stripe.subscriptions.cancel(sub.stripeSubscriptionId);
    } catch {
      // Stripe側で既に解約済みなど、解約自体の失敗でアカウント削除を止めない
    }
  }

  async handleWebhook(req: RawBodyRequest<Request>, sig: string): Promise<void> {
    const secret = process.env.STRIPE_WEBHOOK_SECRET!;
    const event = this.stripe.webhooks.constructEvent(req.rawBody!, sig, secret);

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
    }
  }

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const userId = session.metadata?.userId;
    if (!userId || !session.subscription) return;

    const stripeSub = await this.stripe.subscriptions.retrieve(
      session.subscription as string,
    );

    const item = (stripeSub as any).items?.data?.[0];
    const periodStart = item?.current_period_start ?? (stripeSub as any).current_period_start;
    const periodEnd = item?.current_period_end ?? (stripeSub as any).current_period_end;
    // 年額比率（10 §5）を集計できるようにStripe側の実際の請求周期から判定する
    const planInterval: PlanInterval = item?.price?.recurring?.interval === 'year' ? 'annual' : 'month';

    await this.subRepo.save(
      this.subRepo.create({
        userId,
        stripeCustomerId: session.customer as string,
        stripeSubscriptionId: stripeSub.id,
        status: stripeSub.status as any,
        plan: 'pro',
        planInterval,
        currentPeriodStart: periodStart ? new Date(periodStart * 1000) : null,
        currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
      }),
    );
    await this.profileRepo.update(userId, { plan: 'pro' });
    // KPI: Free→Pro転換（v2 §10.3）。本文や識別子以外の情報は載せない（11 ME-01）
    await this.analytics.track(userId, 'checkout_completed', {
      subscriptionId: stripeSub.id,
      interval: planInterval,
    });
  }

  private async handleSubscriptionDeleted(sub: Stripe.Subscription): Promise<void> {
    const record = await this.subRepo.findOne({ where: { stripeSubscriptionId: sub.id } });
    if (!record) return;
    await this.subRepo.update(record.id, { status: 'canceled' });
    await this.profileRepo.update(record.userId, { plan: 'free' });
  }

  private async handleSubscriptionUpdated(sub: Stripe.Subscription): Promise<void> {
    const item = (sub as any).items?.data?.[0];
    const periodStart = item?.current_period_start ?? (sub as any).current_period_start;
    const periodEnd = item?.current_period_end ?? (sub as any).current_period_end;

    await this.subRepo.update(
      { stripeSubscriptionId: sub.id },
      {
        status: sub.status as any,
        ...(periodStart && { currentPeriodStart: new Date(periodStart * 1000) }),
        ...(periodEnd && { currentPeriodEnd: new Date(periodEnd * 1000) }),
      },
    );
  }
}
