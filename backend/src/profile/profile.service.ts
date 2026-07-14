import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';
import { Profile } from './profile.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { PaymentsService } from '../payments/payments.service';

@Injectable()
export class ProfileService {
  constructor(
    @InjectRepository(Profile)
    private readonly repo: Repository<Profile>,
    @InjectDataSource()
    private readonly ds: DataSource,
    private readonly config: ConfigService,
    private readonly payments: PaymentsService,
  ) {}

  async findOrCreate(userId: string, email: string): Promise<Profile> {
    let profile = await this.repo.findOne({ where: { id: userId } });
    if (!profile) {
      profile = this.repo.create({
        id: userId,
        nickname: email.split('@')[0],
        email,
      });
      await this.repo.save(profile);
      // KPI: 登録完了（プロフィール初回作成 = サインアップ完了。v2 §10.1）
      await this.ds.query(
        `INSERT INTO event_logs (user_id, event_name) VALUES ($1, 'signup_completed')`,
        [userId],
      );
    } else if (!profile.email && email) {
      // 既存プロフィールへのメール補完（リマインド送信用）
      await this.repo.update(userId, { email });
      profile.email = email;
    }
    return profile;
  }

  async update(userId: string, dto: UpdateProfileDto): Promise<Profile> {
    await this.repo.update(userId, {
      ...(dto.nickname && { nickname: dto.nickname }),
      ...(dto.reminderTime !== undefined && { reminderTime: dto.reminderTime }),
      ...(dto.suggestionMuted !== undefined && { suggestionMuted: dto.suggestionMuted }),
      ...(dto.emailReminderEnabled !== undefined && { emailReminderEnabled: dto.emailReminderEnabled }),
    });
    return this.repo.findOneOrFail({ where: { id: userId } });
  }

  async completeOnboarding(userId: string): Promise<Profile> {
    await this.repo.update(userId, { onboardingCompleted: true });
    return this.repo.findOneOrFail({ where: { id: userId } });
  }

  /** AIコーチへのデータ送信に同意した日時を記録する（v2 §7.3） */
  async giveAiConsent(userId: string): Promise<Profile> {
    await this.repo.update(userId, { aiConsentAt: new Date() });
    return this.repo.findOneOrFail({ where: { id: userId } });
  }

  /** モバイルアプリのExpoプッシュトークンを登録する */
  async registerPushToken(userId: string, token: string): Promise<Profile> {
    await this.repo.update(userId, { expoPushToken: token });
    return this.repo.findOneOrFail({ where: { id: userId } });
  }

  /** ログアウト・トークン失効時にプッシュ通知の宛先を解除する */
  async clearPushToken(userId: string): Promise<void> {
    await this.repo.update(userId, { expoPushToken: null });
  }

  /** 全データのJSONエクスポート（v2 §7.3 データポータビリティ） */
  async exportData(userId: string): Promise<Record<string, unknown>> {
    const [profile] = await this.ds.query(
      `SELECT nickname, plan, reminder_time, created_at FROM profiles WHERE id = $1`,
      [userId],
    );
    const categories = await this.ds.query(
      `SELECT name, parent_name, is_active, color, created_at
       FROM categories WHERE user_id = $1 ORDER BY sort_order`,
      [userId],
    );
    const baselines = await this.ds.query(
      `SELECT c.name AS category, b.level, b.created_at
       FROM baseline_assessments b JOIN categories c ON c.id = b.category_id
       WHERE b.user_id = $1`,
      [userId],
    );
    const records = await this.ds.query(
      `SELECT r.recorded_date::text, c.name AS category, ri.score, ri.note
       FROM daily_records r
       JOIN daily_record_items ri ON ri.record_id = r.id
       JOIN categories c ON c.id = ri.category_id
       WHERE r.user_id = $1
       ORDER BY r.recorded_date DESC`,
      [userId],
    );
    const fluctuations = await this.ds.query(
      `SELECT f.occurred_date::text, c.name AS category, f.magnitude, f.note
       FROM fluctuation_events f LEFT JOIN categories c ON c.id = f.category_id
       WHERE f.user_id = $1 ORDER BY f.occurred_date DESC`,
      [userId],
    );
    const reports = await this.ds.query(
      `SELECT week_start_date::text, category_breakdown, fulfillment_total,
              pillar_count, fluctuation_summary, ai_comment
       FROM weekly_reports WHERE user_id = $1 ORDER BY week_start_date DESC`,
      [userId],
    );
    const coachMessages = await this.ds.query(
      `SELECT role, content, created_at FROM ai_coach_messages
       WHERE user_id = $1 ORDER BY created_at`,
      [userId],
    );

    return {
      exportedAt: new Date().toISOString(),
      profile,
      categories,
      baselineAssessments: baselines,
      dailyRecords: records,
      fluctuationEvents: fluctuations,
      weeklyReports: reports,
      aiCoachMessages: coachMessages,
    };
  }

  /**
   * アカウントの完全削除（v2 §7.3）。
   * Stripeの定期課金を解約 → Supabase認証ユーザーを削除 → DBデータをCASCADE削除する。
   * 解約を飛ばして削除すると、DB上の購読記録は消えてもStripe側の課金だけが残り続けてしまう。
   */
  async deleteAccount(userId: string): Promise<void> {
    await this.payments.cancelSubscriptionForDeletedUser(userId);

    const supabaseUrl = this.config.get<string>('SUPABASE_URL');
    const serviceRoleKey = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    const res = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey!,
      },
    });
    if (!res.ok && res.status !== 404) {
      throw new InternalServerErrorException('アカウント削除に失敗しました');
    }

    await this.repo.delete(userId);
  }
}
