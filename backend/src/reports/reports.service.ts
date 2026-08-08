import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';
import { WeeklyReport } from './weekly-report.entity';
import { PortfolioService } from '../portfolio/portfolio.service';
import type { PortfolioPillars } from '../portfolio/portfolio.service';
import { Profile } from '../profile/profile.entity';
import { GeminiService } from '../common/gemini.service';

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
  reason?: 'no_check';
  report?: WeeklyReport;
}

interface WeekAggregation {
  breakdown: Record<string, number>;
  fulfillmentTotal: number;
  entryCount: number;
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

  /**
   * 「今週のまとめ」を生成する。週次点検が完了していれば0件選択でも生成する
   * （06-spec-weekly-check.md §4.2、記録日数によるゲートは撤去）。
   * WeeklyCheckService.upsert() から点検完了のたびに自動で呼ばれるのが主経路。
   */
  async generateReport(userId: string, weekStartDate?: string): Promise<GenerateReportResult> {
    const monday = weekStartDate ?? this.currentMondayJST();
    const weekEnd = this.addDays(monday, 6);

    const checkRow = await this.ds.query<{ id: string }[]>(
      `SELECT id FROM weekly_checks WHERE user_id = $1 AND week_start = $2`,
      [userId, monday],
    );
    if (checkRow.length === 0) {
      return { generated: false, reason: 'no_check' };
    }

    const agg = await this.aggregateWeek(userId, monday);
    const pillars = await this.portfolioService.getPillars(userId);
    const fluctuationSummary = await this.summarizeFluctuations(userId, monday, weekEnd);

    const profile = await this.profileRepo.findOne({ where: { id: userId } });
    let aiComment: string | null = null;
    if (profile?.plan === 'pro') {
      aiComment = await this.generateAiComment(agg, pillars, fluctuationSummary);
    }

    const data: Partial<WeeklyReport> = {
      userId,
      weekStartDate: monday,
      categoryBreakdown: agg.breakdown,
      totalScore: agg.fulfillmentTotal,
      fulfillmentTotal: agg.fulfillmentTotal,
      diversityScore: this.calcDiversityScore(agg.breakdown),
      // 内部指標として保持。UIには出さない（07 §3.5 P-01）。習慣は数えない
      pillarCount: pillars.verified.length + pillars.growing.length,
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

  /**
   * 毎週月曜 0:00 JST に「終わったばかりの前週」のレポートを未生成分だけ補完する保険。
   * 主経路は WeeklyCheckService.upsert() からの同期生成（Cloud Runはスケールゼロするため
   * @Cronでの自走は保証されない）。
   */
  @Cron('0 0 * * 1', { timeZone: 'Asia/Tokyo' })
  async generateWeeklyReportsForAll(): Promise<void> {
    const profiles = await this.profileRepo.find();
    const targetMonday = this.addDays(this.currentMondayJST(), -7);
    const results = await Promise.allSettled(
      profiles.map((p) => this.generateReport(p.id, targetMonday)),
    );
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed > 0) {
      this.logger.warn(`今週のまとめ生成: ${failed}/${profiles.length} 件失敗`);
    }
  }

  /** 対象週のカテゴリ別シェア・充足度を週次点検エントリから集計 */
  private async aggregateWeek(userId: string, weekStart: string): Promise<WeekAggregation> {
    const rows = await this.ds.query<{ name: string; total: string }[]>(
      `SELECT c.name, SUM(wce.level) AS total
       FROM weekly_check_entries wce
       JOIN weekly_checks wc ON wc.id = wce.weekly_check_id
       JOIN categories c ON c.id = wce.category_id
       WHERE wc.user_id = $1 AND wc.week_start = $2
       GROUP BY c.name
       ORDER BY total DESC`,
      [userId, weekStart],
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
      entryCount: rows.length,
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
   * 前週との比較表現は原則1（判定しない）に反するため、前週データは渡さない。
   */
  private async generateAiComment(
    agg: WeekAggregation,
    pillars: PortfolioPillars,
    fluctuations: FluctuationSummary,
  ): Promise<string> {
    const top = Object.entries(agg.breakdown).sort(([, a], [, b]) => b - a)[0];

    if (this.isStub) {
      const topLine = top ? `今週は「${top[0]}」が大きな支えになった週でした。` : '今週は静かな一週間でしたね。';
      return `${topLine}来週も、気の向くままに過ごしてみましょう。`;
    }

    const systemPrompt = `あなたは、ユーザーの週次点検をそっと言葉にする書き手です。日本語で書いてください。

## ルール
- 200文字以内
- 構成: ①ねぎらい ②データから読み取れる気づき1つ ③来週できる小さな行動1つ
- 与えられた集計データに含まれる事実のみに言及する。データにない事柄（睡眠・食事・体調など）を推測して書かない
- 数値・パーセンテージ・本数・件数を一切引用しない
- 前週との比較や増減の指摘をしない
- 医療・診断的な表現はしない
- 「依存」という言葉を使わず、「柱を育てる」という表現を使う`;

    // 数値は渡さない。名前と状態だけを渡す（07 §3.5 / 08 §4.4）
    const pillarLine = [
      pillars.verified.length > 0 ? `確かな柱: ${pillars.verified.map((p) => p.categoryName).join('、')}` : null,
      pillars.growing.length > 0 ? `育て中: ${pillars.growing.map((p) => p.categoryName).join('、')}` : null,
    ]
      .filter(Boolean)
      .join(' / ');

    const userContent = `## 今週の集計
- 支えになったもの: ${Object.keys(agg.breakdown).join('、') || 'なし'}
${pillarLine ? `- 柱: ${pillarLine}\n` : ''}- 心が揺れた出来事: ${
      fluctuations.events.length > 0
        ? fluctuations.events.map((e) => `${e.categoryName ?? '不明'}・${e.magnitude}`).join('、')
        : 'なし'
    }`;

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
