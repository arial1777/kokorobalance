import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

interface ReminderTarget {
  id: string;
  nickname: string;
  email: string | null;
  unsubscribe_token: string;
  expo_push_token: string | null;
}

/** 04-spec-distribution.md §4.2: 1日最大2通・1週最大5通。超える場合は送らない */
const DAILY_NOTIFICATION_CAP = 2;
const WEEKLY_NOTIFICATION_CAP = 5;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly config: ConfigService,
  ) {}

  /** 静音時間（04-spec-distribution.md §4.2）: 22:30〜07:30 JST は送らない */
  isQuietHours(now: Date = new Date()): boolean {
    const jst = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Tokyo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now);
    const [h, m] = jst.split(':').map(Number);
    const minutes = h * 60 + m;
    return minutes >= 22 * 60 + 30 || minutes < 7 * 60 + 30;
  }

  /** 1日2通・1週5通の上限内かどうか（04-spec-distribution.md §4.2） */
  private async withinBudget(userId: string): Promise<boolean> {
    const [{ count: dailyCount }] = await this.ds.query<{ count: string }[]>(
      `SELECT count(*)::int AS count FROM notification_logs
       WHERE user_id = $1 AND sent_at >= now() - INTERVAL '24 hours'`,
      [userId],
    );
    if (Number(dailyCount) >= DAILY_NOTIFICATION_CAP) return false;

    const [{ count: weeklyCount }] = await this.ds.query<{ count: string }[]>(
      `SELECT count(*)::int AS count FROM notification_logs
       WHERE user_id = $1 AND sent_at >= now() - INTERVAL '7 days'`,
      [userId],
    );
    return Number(weeklyCount) < WEEKLY_NOTIFICATION_CAP;
  }

  /**
   * 週次点検のリマインド（06-spec-weekly-check.md N-01）。Cloud Schedulerから30分刻みで
   * POST /notifications/cron/weekly-check-reminders を叩いて起動する
   * （Cloud Runはスケールゼロするため@Cronでの自走はできない）。
   * 日曜日、リマインド時刻が直前30分窓に入ったユーザーのうち今週未点検の人へ送る。
   * 「3日間記録がありません」のような催促は行わない（原則1/5、04-spec-distribution.md §4.1）。
   * 未実施でも翌週まで再送しない（催促は1回のみ）。
   */
  async sendWeeklyCheckReminders(): Promise<void> {
    if (this.isQuietHours()) return;

    const { today, windowStart, windowEnd } = this.jstNow();
    if (new Date(`${today}T00:00:00Z`).getUTCDay() !== 0) return; // 日曜のみ

    const weekStart = this.mondayOf(today);

    const targets = await this.ds.query<ReminderTarget[]>(
      `SELECT p.id, p.nickname, p.email, p.unsubscribe_token, p.expo_push_token
       FROM profiles p
       WHERE (p.email IS NOT NULL OR p.expo_push_token IS NOT NULL)
         AND p.email_reminder_enabled = true
         AND p.reminder_time IS NOT NULL
         AND p.reminder_time >= $1 AND p.reminder_time < $2
         AND NOT EXISTS (
           SELECT 1 FROM weekly_checks wc
           WHERE wc.user_id = p.id AND wc.week_start = $3
         )
         AND NOT EXISTS (
           SELECT 1 FROM notification_logs n
           WHERE n.user_id = p.id AND n.type = 'weekly_check_reminder'
             AND n.sent_at >= ($3 || ' 00:00:00+09')::timestamptz
         )`,
      [windowStart, windowEnd, weekStart],
    );

    for (const t of targets) {
      if (!(await this.withinBudget(t.id))) continue;
      if (t.expo_push_token) {
        await this.sendPush(
          t.expo_push_token,
          'ココロバランス',
          `${t.nickname}さん、今週、支えになったのはなんでしたか？（30秒）`,
          { url: '/record' },
        );
      } else if (t.email) {
        await this.sendEmail(
          t.email,
          '今週、支えになったのはなんでしたか？ | ココロバランス',
          this.weeklyCheckReminderHtml(t),
        );
      }
      await this.logSent(t.id, 'weekly_check_reminder');
    }
    if (targets.length > 0) {
      this.logger.log(`週次点検リマインド送信: ${targets.length}件`);
    }
  }

  /**
   * 汎用の通知送信（揺れ予報等、日次リマインド/復帰通知以外の機能から利用する）。
   * 静音時間・頻度上限を尊重し、プッシュ→メールの順にフォールバックする。
   * 戻り値は実際に送信されたか（静音時間・上限超過・宛先なしの場合はfalse）。
   */
  async notifyUser(
    userId: string,
    type: string,
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<boolean> {
    if (this.isQuietHours()) return false;
    if (!(await this.withinBudget(userId))) return false;

    const [target] = await this.ds.query<ReminderTarget[]>(
      `SELECT id, nickname, email, unsubscribe_token, expo_push_token FROM profiles WHERE id = $1`,
      [userId],
    );
    if (!target) return false;

    if (target.expo_push_token) {
      await this.sendPush(target.expo_push_token, title, body, data);
    } else if (target.email) {
      await this.sendEmail(target.email, title, this.genericHtml(target, title, body, data));
    } else {
      return false;
    }
    await this.logSent(userId, type);
    return true;
  }

  private genericHtml(t: ReminderTarget, heading: string, bodyText: string, data?: Record<string, unknown>): string {
    const appUrl = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
    const path = typeof data?.url === 'string' ? data.url : '/dashboard';
    return `
<div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
  <h2 style="color: #1A3352;">${this.escapeHtml(heading)}</h2>
  <p>${this.escapeHtml(bodyText)}</p>
  <a href="${appUrl}${path}"
     style="display: inline-block; background: #E05A3A; color: #fff; padding: 12px 24px; border-radius: 12px; text-decoration: none; font-weight: bold;">
    ひらく
  </a>
  ${this.footerHtml(t)}
</div>`;
  }

  /** ワンクリック配信停止（認証不要・トークンで本人特定） */
  async unsubscribe(token: string): Promise<void> {
    const result = await this.ds.query(
      `UPDATE profiles SET email_reminder_enabled = false
       WHERE unsubscribe_token = $1 RETURNING id`,
      [token],
    );
    if (result[0]?.length === 0 && result[1] === 0) {
      throw new NotFoundException('無効なリンクです');
    }
  }

  /** RESEND_API_KEY があればResendで送信、無ければログ出力のみ（開発用スタブ） */
  private async sendEmail(to: string, subject: string, html: string): Promise<void> {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    const from = this.config.get<string>('MAIL_FROM') ?? 'ココロバランス <noreply@kokorobalance.app>';

    if (!apiKey) {
      this.logger.log(`[メールスタブ] to=${to} subject=${subject}`);
      return;
    }

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ from, to, subject, html }),
      });
      if (!res.ok) {
        this.logger.warn(`メール送信失敗 to=${to}: ${res.status} ${await res.text()}`);
      }
    } catch (e) {
      this.logger.warn(`メール送信エラー to=${to}: ${String(e)}`);
    }
  }

  /** Expo Push Notifications経由でモバイルアプリに通知を送る */
  private async sendPush(
    token: string,
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    try {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ to: token, title, body, data, sound: 'default' }),
      });
      if (!res.ok) {
        this.logger.warn(`プッシュ通知送信失敗: ${res.status} ${await res.text()}`);
        return;
      }
      const json = (await res.json()) as { data?: { status?: string; details?: { error?: string } } };
      if (json.data?.status === 'error' && json.data.details?.error === 'DeviceNotRegistered') {
        await this.ds.query(`UPDATE profiles SET expo_push_token = NULL WHERE expo_push_token = $1`, [token]);
      }
    } catch (e) {
      this.logger.warn(`プッシュ通知送信エラー: ${String(e)}`);
    }
  }

  private weeklyCheckReminderHtml(t: ReminderTarget): string {
    const appUrl = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
    return `
<div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
  <h2 style="color: #1A3352;">${this.escapeHtml(t.nickname)}さん、今週もおつかれさまでした 🌙</h2>
  <p>この1週間、支えになったのはなんでしたか？</p>
  <p>タップだけ、30秒で点検できます。</p>
  <a href="${appUrl}/record"
     style="display: inline-block; background: #E05A3A; color: #fff; padding: 12px 24px; border-radius: 12px; text-decoration: none; font-weight: bold;">
    今週の点検をする
  </a>
  ${this.footerHtml(t)}
</div>`;
  }

  private footerHtml(t: ReminderTarget): string {
    const apiUrl = this.config.get<string>('API_PUBLIC_URL') ?? 'http://localhost:4000';
    return `
  <p style="color: #999; font-size: 11px; margin-top: 32px; line-height: 1.6;">
    ココロバランスは医療・診断を目的としたアプリではありません。<br/>
    <a href="${apiUrl}/api/notifications/unsubscribe/${t.unsubscribe_token}" style="color: #999;">このメールの配信を停止する</a>
  </p>`;
  }

  private escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  private async logSent(userId: string, type: string): Promise<void> {
    await this.ds.query(
      `INSERT INTO notification_logs (user_id, type) VALUES ($1, $2)`,
      [userId, type],
    );
  }

  private jstNow(): { today: string; windowStart: string; windowEnd: string } {
    const now = new Date();
    const jst = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Tokyo',
      dateStyle: 'short',
      timeStyle: 'medium',
    }).format(now); // "YYYY-MM-DD HH:mm:ss"
    const [today, time] = jst.split(' ');

    // 現在の30分スロット（例: 21:30実行 → 21:30〜22:00 が対象。設定時刻ちょうどに届く）
    const [h, m] = time.split(':').map(Number);
    const startMinutes = h * 60 + m - (m % 30);
    const endMinutes = startMinutes + 30;
    const fmt = (mins: number) => {
      const mm = ((mins % 1440) + 1440) % 1440;
      return `${String(Math.floor(mm / 60)).padStart(2, '0')}:${String(mm % 60).padStart(2, '0')}:00`;
    };
    return { today, windowStart: fmt(startMinutes), windowEnd: fmt(endMinutes) };
  }

  /** 指定日を含む週の月曜日（週の定義は他サービスと統一） */
  private mondayOf(date: string): string {
    const d = new Date(`${date}T00:00:00Z`);
    const day = d.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setUTCDate(d.getUTCDate() + diff);
    return d.toISOString().split('T')[0];
  }
}
