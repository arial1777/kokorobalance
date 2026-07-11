import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';
import { WeeklyReport } from './weekly-report.entity';
import { PortfolioService } from '../portfolio/portfolio.service';
import { Profile } from '../profile/profile.entity';
import { GeminiService } from '../common/gemini.service';

/** レポート生成に必要な週内の最低記録日数 */
const MIN_RECORD_DAYS = 2;

export interface FluctuationSummary {
  count: number;
  byMagnitude: { small: number; medium: number; large: number };
  events: {
    occurredDate: string;
    magnitude: 'small' | 'medium' | 'large';
    categoryName: string | null;
    note: string | null;
  }[];
}

export interface GenerateReportResult {
  generated: boolean;
  reason?: 'insufficient_records';
  recordDays?: number;
  report?: WeeklyReport;
}

interface WeekAggregation {
  breakdown: Record<string, number>;
  fulfillmentTotal: number;
  recordDays: number;
}

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);
  private readonly isStub: boolean;

  constructor(
    @InjectRepository(WeeklyReport)
    private readonly reportRepo: Repository<WeeklyReport>,
    @InjectRepository(Profile)
    private readonly profileRepo: Repository<Profile>,
    @InjectDataSource()
    private readonly ds: DataSource,
    private readonly portfolioService: PortfolioService,
    private readonly gemini: GeminiService,
    private readonly config: ConfigService,
  ) {
    // AI_STUB を明示的に 'false' にした場合のみ実API呼び出しに切り替える(デフォルトは安全側でスタブ)
    this.isStub = config.get<string>('AI_STUB') !== 'false';
  }

  getReports(userId: string): Promise<WeeklyReport[]> {
    return this.reportRepo.find({
      where: { userId },
      order: { weekStartDate: 'DESC' },
      take: 12,
    });
  }

  getReport(userId: string, weekStartDate: string): Promise<WeeklyReport | null> {
    return this.reportRepo.findOne({ where: { userId, weekStartDate: weekStartDate as any } });
  }

  async generateReport(userId: string, weekStartDate?: string): Promise<GenerateReportResult> {
    const monday = weekStartDate ?? this.currentMondayJST();
    const weekEnd = this.addDays(monday, 6);

    const agg = await this.aggregateWeek(userId, monday, weekEnd);

    // 記録2日未満の週はレポートを生成しない（v2 §5.1.6）
    if (agg.recordDays < MIN_RECORD_DAYS) {
      return { generated: false, reason: 'insufficient_records', recordDays: agg.recordDays };
    }

    const pillars = await this.portfolioService.getPillars(userId);
    const fluctuationSummary = await this.summarizeFluctuations(userId, monday, weekEnd);

    const profile = await this.profileRepo.findOne({ where: { id: userId } });
    let aiComment: string | null = null;
    if (profile?.plan === 'pro') {
      const previous = await this.getReport(userId, this.addDays(monday, -7));
      aiComment = await this.generateAiComment(agg, previous, pillars.count, fluctuationSummary);
    }

    const data: Partial<WeeklyReport> = {
      userId,
      weekStartDate: monday,
      categoryBreakdown: agg.breakdown,
      totalScore: agg.fulfillmentTotal,
      fulfillmentTotal: agg.fulfillmentTotal,
      diversityScore: this.calcDiversityScore(agg.breakdown),
      pillarCount: pillars.count,
      fluctuationSummary: fluctuationSummary as unknown as Record<string, unknown>,
      aiComment,
    };

    const existing = await this.reportRepo.findOne({
      where: { userId, weekStartDate: monday as any },
    });

    let report: WeeklyReport;
    if (existing) {
      await this.reportRepo.update(existing.id, data as any);
      report = await this.reportRepo.findOneOrFail({ where: { id: existing.id } });
    } else {
      report = await this.reportRepo.save(this.reportRepo.create(data as any) as unknown as WeeklyReport);
    }
    return { generated: true, report };
  }

  /** 毎週月曜 0:00 JST に「終わったばかりの前週」のレポートを全ユーザー分生成 */
  @Cron('0 0 * * 1', { timeZone: 'Asia/Tokyo' })
  async generateWeeklyReportsForAll(): Promise<void> {
    const profiles = await this.profileRepo.find();
    // 月曜0時時点の currentMonday はその日自身なので、対象は前週の月曜
    const targetMonday = this.addDays(this.currentMondayJST(), -7);
    const results = await Promise.allSettled(
      profiles.map((p) => this.generateReport(p.id, targetMonday)),
    );
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed > 0) {
      this.logger.warn(`週間レポート生成: ${failed}/${profiles.length} 件失敗`);
    }
  }

  /** 対象週のカテゴリ別シェア・充足度・記録日数を集計 */
  private async aggregateWeek(userId: string, from: string, to: string): Promise<WeekAggregation> {
    const rows = await this.ds.query<{ name: string; total: string }[]>(
      `SELECT c.name, SUM(ri.score) AS total
       FROM daily_record_items ri
       JOIN daily_records r ON r.id = ri.record_id
       JOIN categories c ON c.id = ri.category_id
       WHERE r.user_id = $1
         AND r.recorded_date BETWEEN $2 AND $3
         AND ri.score > 0
       GROUP BY c.name
       ORDER BY total DESC`,
      [userId, from, to],
    );

    const daysRow = await this.ds.query<{ count: string }[]>(
      `SELECT COUNT(DISTINCT recorded_date) AS count
       FROM daily_records
       WHERE user_id = $1 AND recorded_date BETWEEN $2 AND $3`,
      [userId, from, to],
    );

    const grandTotal = rows.reduce((s, r) => s + Number(r.total), 0);
    const breakdown: Record<string, number> = {};
    rows.forEach((r) => {
      breakdown[r.name] =
        grandTotal > 0 ? Math.round((Number(r.total) / grandTotal) * 1000) / 10 : 0;
    });

    return {
      breakdown,
      fulfillmentTotal: grandTotal,
      recordDays: Number(daysRow[0]?.count ?? 0),
    };
  }

  private async summarizeFluctuations(
    userId: string,
    from: string,
    to: string,
  ): Promise<FluctuationSummary> {
    const rows = await this.ds.query<
      { occurred_date: string; magnitude: 'small' | 'medium' | 'large'; name: string | null; note: string | null }[]
    >(
      `SELECT f.occurred_date::text AS occurred_date, f.magnitude, c.name, f.note
       FROM fluctuation_events f
       LEFT JOIN categories c ON c.id = f.category_id
       WHERE f.user_id = $1 AND f.occurred_date BETWEEN $2 AND $3
       ORDER BY f.occurred_date DESC, f.created_at DESC
       LIMIT 10`,
      [userId, from, to],
    );

    const byMagnitude = { small: 0, medium: 0, large: 0 };
    rows.forEach((r) => byMagnitude[r.magnitude]++);

    return {
      count: rows.length,
      byMagnitude,
      events: rows.map((r) => ({
        occurredDate: r.occurred_date,
        magnitude: r.magnitude,
        categoryName: r.name,
        note: r.note,
      })),
    };
  }

  /**
   * Pro向けAIコメント生成。
   * 与えられた集計データに含まれる事実のみに言及させる（推測・捏造の禁止）。
   */
  private async generateAiComment(
    agg: WeekAggregation,
    previous: WeeklyReport | null,
    pillarCount: number,
    fluctuations: FluctuationSummary,
  ): Promise<string> {
    const top = Object.entries(agg.breakdown).sort(([, a], [, b]) => b - a)[0];

    if (this.isStub) {
      const base = `今週は${agg.recordDays}日記録できました。おつかれさまです。`;
      const topLine = top ? `「${top[0]}」が${top[1]}%と、あなたを一番支えてくれた週でした。` : '';
      return `${base}${topLine}来週も、まずは1日の記録から始めてみましょう。`;
    }

    const systemPrompt = `あなたは心のバランスコーチです。ユーザーの週間データをもとに、週の振り返りコメントを日本語で書いてください。

## ルール
- 200文字以内
- 構成: ①ねぎらい ②データから読み取れる気づき1つ ③来週できる小さな行動1つ
- 与えられた集計データに含まれる事実のみに言及する。データにない事柄（睡眠・食事・体調など）を推測して書かない
- 医療・診断的な表現はしない
- 「依存」という言葉を使わず、「柱を育てる」という表現を使う`;

    const userContent = `## 今週の集計
- 記録日数: ${agg.recordDays}日
- 充足度合計: ${agg.fulfillmentTotal}pt
- カテゴリ別シェア: ${JSON.stringify(agg.breakdown)}
- 心の柱: ${pillarCount}本
- 心が揺れた出来事: ${fluctuations.count}件${fluctuations.events.length > 0 ? ` (${fluctuations.events.map((e) => `${e.categoryName ?? '不明'}・${e.magnitude}`).join(', ')})` : ''}
${previous ? `## 前週の集計
- 充足度合計: ${previous.fulfillmentTotal}pt
- カテゴリ別シェア: ${JSON.stringify(previous.categoryBreakdown)}` : '## 前週のデータはありません'}`;

    return this.gemini.generate(systemPrompt, [{ role: 'user', content: userContent }]);
  }

  private calcDiversityScore(breakdown: Record<string, number>): number {
    const shares = Object.values(breakdown);
    if (shares.length === 0) return 0;
    const hhi = shares.reduce((sum, pct) => sum + (pct / 100) ** 2, 0);
    return Math.round((1 - hhi) * 100);
  }

  /** JST基準で今週の月曜日を返す */
  private currentMondayJST(): string {
    const todayStr = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date());
    const d = new Date(`${todayStr}T00:00:00Z`);
    const day = d.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setUTCDate(d.getUTCDate() + diff);
    return d.toISOString().split('T')[0];
  }

  private addDays(date: string, days: number): string {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().split('T')[0];
  }
}
