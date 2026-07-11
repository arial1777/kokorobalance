import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

interface ReminderTarget {
  id: string;
  nickname: string;
  email: string | null;
  unsubscribe_token: string;
  expo_push_token: string | null;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly config: ConfigService,
  ) {}

  /**
   * 毎日のリマインド（v2 §6）。30分刻みのcronで、
   * リマインド時刻が直前30分窓に入ったユーザーのうち当日未記録の人へ送る。
   */
  @Cron('0,30 * * * *', { timeZone: 'Asia/Tokyo' })
  async sendDailyReminders(): Promise<void> {
    const { today, windowStart, windowEnd } = this.jstNow();

    const targets = await this.ds.query<ReminderTarget[]>(
      `SELECT p.id, p.nickname, p.email, p.unsubscribe_token, p.expo_push_token
       FROM profiles p
       WHERE (p.email IS NOT NULL OR p.expo_push_token IS NOT NULL)
         AND p.email_reminder_enabled = true
         AND p.reminder_time IS NOT NULL
         AND p.reminder_time >= $1 AND p.reminder_time < $2
         AND NOT EXISTS (
           SELECT 1 FROM daily_records r
           WHERE r.user_id = p.id AND r.recorded_date = $3
         )
         AND NOT EXISTS (
           SELECT 1 FROM notification_logs n
           WHERE n.user_id = p.id AND n.type = 'daily_reminder'
             AND n.sent_at >= ($3 || ' 00:00:00+09')::timestamptz
         )`,
      [windowStart, windowEnd, today],
    );

    for (const t of targets) {
      if (t.expo_push_token) {
        await this.sendPush(
          t.expo_push_token,
          'ココロバランス',
          `${t.nickname}さん、今日の心は何で満たされましたか？`,
          { url: '/record' },
        );
      } else if (t.email) {
        await this.sendEmail(
          t.email,
          '今日の心、何で満たされましたか？ | ココロバランス',
          this.reminderHtml(t),
        );
      }
      await this.logSent(t.id, 'daily_reminder');
    }
    if (targets.length > 0) {
      this.logger.log(`日次リマインド送信: ${targets.length}件`);
    }
  }

  /**
   * 復帰メール（v2 §6）。3日以上記録が途切れたユーザーへ週1回まで。
   * 罪悪感を煽らない「おかえりなさい」トーン。毎日19:00 JSTに判定。
   */
  @Cron('0 19 * * *', { timeZone: 'Asia/Tokyo' })
  async sendComebackEmails(): Promise<void> {
    const { today } = this.jstNow();

    const targets = await this.ds.query<ReminderTarget[]>(
      `SELECT p.id, p.nickname, p.email, p.unsubscribe_token, p.expo_push_token
       FROM profiles p
       WHERE (p.email IS NOT NULL OR p.expo_push_token IS NOT NULL)
         AND p.email_reminder_enabled = true
         AND (
           SELECT MAX(r.recorded_date) FROM daily_records r WHERE r.user_id = p.id
         ) <= ($1::date - INTERVAL '3 days')
         AND NOT EXISTS (
           SELECT 1 FROM notification_logs n
           WHERE n.user_id = p.id AND n.type = 'comeback'
             AND n.sent_at >= now() - INTERVAL '7 days'
         )`,
      [today],
    );

    for (const t of targets) {
      if (t.expo_push_token) {
        await this.sendPush(
          t.expo_push_token,
          'ココロバランス',
          `${t.nickname}さん、おかえりなさい。今日のことをひとつだけ記録してみませんか？`,
          { url: '/record' },
        );
      } else if (t.email) {
        await this.sendEmail(
          t.email,
          'おかえりなさい | ココロバランス',
          this.comebackHtml(t),
        );
      }
      await this.logSent(t.id, 'comeback');
    }
    if (targets.length > 0) {
      this.logger.log(`復帰通知送信: ${targets.length}件`);
    }
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

  private reminderHtml(t: ReminderTarget): string {
    const appUrl = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
    return `
<div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
  <h2 style="color: #1A3352;">${this.escapeHtml(t.nickname)}さん、こんばんは 🌙</h2>
  <p>今日、あなたの心は何で満たされましたか？</p>
  <p>タップだけ、10秒で記録できます。</p>
  <a href="${appUrl}/record"
     style="display: inline-block; background: #E05A3A; color: #fff; padding: 12px 24px; border-radius: 12px; text-decoration: none; font-weight: bold;">
    今日の記録をする
  </a>
  ${this.footerHtml(t)}
</div>`;
  }

  private comebackHtml(t: ReminderTarget): string {
    const appUrl = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
    return `
<div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
  <h2 style="color: #1A3352;">${this.escapeHtml(t.nickname)}さん、おかえりなさい 🌱</h2>
  <p>しばらく記録がなくても大丈夫。あなたの心の柱は、いつでもここから育て直せます。</p>
  <p>今日のことをひとつだけ、10秒で記録してみませんか？</p>
  <a href="${appUrl}/record"
     style="display: inline-block; background: #E05A3A; color: #fff; padding: 12px 24px; border-radius: 12px; text-decoration: none; font-weight: bold;">
    ひさしぶりに記録する
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
}
