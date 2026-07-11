import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface PortfolioBreakdownItem {
  categoryName: string;
  parentName: string;
  totalScore: number;
  percentage: number;
  color: string;
}

export type PillarStage = 'sprout' | 'young' | 'pillar';

export interface PillarItem {
  categoryName: string;
  color: string;
  stage: PillarStage;
  /** 直近28日の週あたり平均記録日数 */
  weeklyFrequency: number;
  /** 直近4週のうち記録があった週の数 */
  activeWeeks: number;
}

export interface PortfolioPillars {
  count: number;
  items: PillarItem[];
}

export interface PortfolioFulfillment {
  /** 期間内の合計ポイント（充足度・絶対量） */
  total: number;
  weeklyTrend: { weekStart: string; total: number }[];
}

export interface PortfolioSuggestion {
  exists: boolean;
  topCategoryName?: string;
  topPercentage?: number;
  suggestedCategoryName?: string;
  message?: string;
}

export interface PortfolioResult {
  periodDays: number;
  breakdown: PortfolioBreakdownItem[];
  fulfillment: PortfolioFulfillment;
  pillars: PortfolioPillars;
  suggestion: PortfolioSuggestion;
  /** 内部指標（1 - HHI）。UIの主役にはしない */
  diversityScore: number;
  totalRecordDays: number;
  /** オンボーディング診断をブレンド中か（日次記録14日未満） */
  isBlended: boolean;
}

/** 診断データを実データへ完全移行するまでの日次記録日数 */
const BLEND_FULL_DAYS = 14;

/** 育成提案のデータ下限（誤提案を防ぐ） */
const SUGGESTION_MIN_DAYS = 7;
const SUGGESTION_MIN_ITEMS = 10;
const SUGGESTION_SHARE_THRESHOLD = 60;

interface CategoryPoint {
  categoryId: string;
  categoryName: string;
  parentName: string;
  color: string;
  points: number;
}

@Injectable()
export class PortfolioService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async getPortfolio(userId: string, periodDays: number): Promise<PortfolioResult> {
    const rows = await this.ds.query<
      { category_id: string; name: string; parent_name: string; color: string; total_score: string }[]
    >(
      `SELECT c.id AS category_id, c.name, c.parent_name, c.color,
              SUM(ri.score) AS total_score
       FROM daily_record_items ri
       JOIN daily_records r ON r.id = ri.record_id
       JOIN categories c ON c.id = ri.category_id
       WHERE r.user_id = $1
         AND r.recorded_date >= CURRENT_DATE - ($2 || ' days')::INTERVAL
         AND ri.score > 0
       GROUP BY c.id, c.name, c.parent_name, c.color
       ORDER BY total_score DESC`,
      [userId, periodDays],
    );

    const totalDaysRow = await this.ds.query<{ count: string }[]>(
      `SELECT COUNT(DISTINCT recorded_date) AS count
       FROM daily_records
       WHERE user_id = $1
         AND recorded_date >= CURRENT_DATE - ($2 || ' days')::INTERVAL`,
      [userId, periodDays],
    );

    // ブレンド・提案下限の判定は期間によらず「これまでの記録」で行う
    const overallRow = await this.ds.query<{ days: string; items: string }[]>(
      `SELECT COUNT(DISTINCT r.recorded_date) AS days,
              COUNT(ri.id) AS items
       FROM daily_records r
       LEFT JOIN daily_record_items ri ON ri.record_id = r.id
       WHERE r.user_id = $1`,
      [userId],
    );
    const overallDays = Number(overallRow[0]?.days ?? 0);
    const overallItems = Number(overallRow[0]?.items ?? 0);
    const blendWeight = Math.max(0, (BLEND_FULL_DAYS - overallDays) / BLEND_FULL_DAYS);

    const actual: CategoryPoint[] = rows.map((r) => ({
      categoryId: r.category_id,
      categoryName: r.name,
      parentName: r.parent_name,
      color: r.color,
      points: Number(r.total_score),
    }));

    let baselines: { category_id: string; level: number; name: string; parent_name: string; color: string }[] = [];
    if (blendWeight > 0) {
      baselines = await this.ds.query(
        `SELECT b.category_id, b.level, c.name, c.parent_name, c.color
         FROM baseline_assessments b
         JOIN categories c ON c.id = b.category_id
         WHERE b.user_id = $1 AND c.is_active = true`,
        [userId],
      );
    }

    const { breakdown, isBlended } = this.buildBreakdown(actual, baselines, blendWeight);
    const pillars = await this.getPillars(userId);
    const fulfillment = await this.buildFulfillment(userId, periodDays, actual);
    const suggestion = await this.buildSuggestion(userId, breakdown, pillars, overallDays, overallItems);

    return {
      periodDays,
      breakdown,
      fulfillment,
      pillars,
      suggestion,
      diversityScore: this.calcDiversityScore(breakdown),
      totalRecordDays: Number(totalDaysRow[0]?.count ?? 0),
      isBlended,
    };
  }

  /**
   * シェア% = (1 - w)・実データシェア + w・診断シェア
   * 実データが無いうちは診断シェアのみ。記録14日でw=0となり実データへ完全移行。
   */
  private buildBreakdown(
    actual: CategoryPoint[],
    baselines: { category_id: string; level: number; name: string; parent_name: string; color: string }[],
    blendWeight: number,
  ): { breakdown: PortfolioBreakdownItem[]; isBlended: boolean } {
    const actualTotal = actual.reduce((s, a) => s + a.points, 0);

    if (blendWeight <= 0 || baselines.length === 0) {
      const breakdown = actual.map((a) => ({
        categoryName: a.categoryName,
        parentName: a.parentName,
        totalScore: a.points,
        percentage: actualTotal > 0 ? Math.round((a.points / actualTotal) * 1000) / 10 : 0,
        color: a.color,
      }));
      return { breakdown, isBlended: false };
    }

    const baseTotal = baselines.reduce((s, b) => s + b.level, 0);
    const actualById = new Map(actual.map((a) => [a.categoryId, a]));

    const union = new Map<string, CategoryPoint & { baseLevel: number }>();
    for (const a of actual) {
      union.set(a.categoryId, { ...a, baseLevel: 0 });
    }
    for (const b of baselines) {
      const existing = union.get(b.category_id);
      if (existing) {
        existing.baseLevel = b.level;
      } else {
        union.set(b.category_id, {
          categoryId: b.category_id,
          categoryName: b.name,
          parentName: b.parent_name,
          color: b.color,
          points: 0,
          baseLevel: b.level,
        });
      }
    }

    const breakdown: PortfolioBreakdownItem[] = [];
    for (const item of union.values()) {
      const actualShare = actualTotal > 0 ? item.points / actualTotal : 0;
      const baseShare = baseTotal > 0 ? item.baseLevel / baseTotal : 0;
      const share =
        actualTotal > 0
          ? (1 - blendWeight) * actualShare + blendWeight * baseShare
          : baseShare;
      const percentage = Math.round(share * 1000) / 10;
      if (percentage <= 0) continue;
      breakdown.push({
        categoryName: item.categoryName,
        parentName: item.parentName,
        totalScore: actualById.get(item.categoryId)?.points ?? 0,
        percentage,
        color: item.color,
      });
    }
    breakdown.sort((a, b) => b.percentage - a.percentage);

    return { breakdown, isBlended: true };
  }

  /**
   * 心の柱: 直近28日を7日ごとの4バケットに分け、直近14日以内に記録のある
   * カテゴリを柱として数える。記録があった週の数で成長段階を決める。
   * 芽(1週) → 若木(2〜3週) → 柱(4週)
   */
  async getPillars(userId: string): Promise<PortfolioPillars> {
    const rows = await this.ds.query<
      { category_id: string; name: string; color: string; week_bucket: number; days: string }[]
    >(
      `SELECT c.id AS category_id, c.name, c.color,
              ((CURRENT_DATE - r.recorded_date) / 7)::int AS week_bucket,
              COUNT(DISTINCT r.recorded_date) AS days
       FROM daily_record_items ri
       JOIN daily_records r ON r.id = ri.record_id
       JOIN categories c ON c.id = ri.category_id
       WHERE r.user_id = $1
         AND r.recorded_date >= CURRENT_DATE - INTERVAL '27 days'
         AND c.is_active = true
       GROUP BY c.id, c.name, c.color, week_bucket`,
      [userId],
    );

    const byCategory = new Map<
      string,
      { name: string; color: string; buckets: Set<number>; totalDays: number }
    >();
    for (const r of rows) {
      const entry = byCategory.get(r.category_id) ?? {
        name: r.name,
        color: r.color,
        buckets: new Set<number>(),
        totalDays: 0,
      };
      entry.buckets.add(Number(r.week_bucket));
      entry.totalDays += Number(r.days);
      byCategory.set(r.category_id, entry);
    }

    const items: PillarItem[] = [];
    for (const entry of byCategory.values()) {
      // 直近14日（バケット0・1）に記録がないカテゴリは柱に数えない
      if (!entry.buckets.has(0) && !entry.buckets.has(1)) continue;
      const activeWeeks = entry.buckets.size;
      const stage: PillarStage = activeWeeks >= 4 ? 'pillar' : activeWeeks >= 2 ? 'young' : 'sprout';
      items.push({
        categoryName: entry.name,
        color: entry.color,
        stage,
        weeklyFrequency: Math.round((entry.totalDays / 4) * 10) / 10,
        activeWeeks,
      });
    }
    items.sort((a, b) => b.activeWeeks - a.activeWeeks || b.weeklyFrequency - a.weeklyFrequency);

    return { count: items.length, items };
  }

  private async buildFulfillment(
    userId: string,
    periodDays: number,
    actual: CategoryPoint[],
  ): Promise<PortfolioFulfillment> {
    const rows = await this.ds.query<{ week_start: string; total: string }[]>(
      `SELECT (DATE_TRUNC('week', r.recorded_date))::date AS week_start,
              SUM(ri.score) AS total
       FROM daily_record_items ri
       JOIN daily_records r ON r.id = ri.record_id
       WHERE r.user_id = $1
         AND r.recorded_date >= CURRENT_DATE - ($2 || ' days')::INTERVAL
         AND ri.score > 0
       GROUP BY week_start
       ORDER BY week_start`,
      [userId, periodDays],
    );

    return {
      total: actual.reduce((s, a) => s + a.points, 0),
      weeklyTrend: rows.map((r) => ({
        weekStart: typeof r.week_start === 'string' ? r.week_start : new Date(r.week_start).toISOString().split('T')[0],
        total: Number(r.total),
      })),
    };
  }

  /**
   * 育成提案（旧・偏りアラート）。
   * データ下限（記録7日以上かつ10件以上）を満たし、最大カテゴリのシェアが60%以上
   * または柱が1本以下のときに、ポジティブな文言で「次に育てる柱」を提案する。
   */
  private async buildSuggestion(
    userId: string,
    breakdown: PortfolioBreakdownItem[],
    pillars: PortfolioPillars,
    overallDays: number,
    overallItems: number,
  ): Promise<PortfolioSuggestion> {
    if (overallDays < SUGGESTION_MIN_DAYS || overallItems < SUGGESTION_MIN_ITEMS) {
      return { exists: false };
    }

    const mutedRow = await this.ds.query<{ suggestion_muted: boolean }[]>(
      `SELECT suggestion_muted FROM profiles WHERE id = $1`,
      [userId],
    );
    if (mutedRow[0]?.suggestion_muted) return { exists: false };

    const top = breakdown[0];
    const triggered =
      (top && top.percentage >= SUGGESTION_SHARE_THRESHOLD) || pillars.count <= 1;
    if (!triggered || !top) return { exists: false };

    // 提案カテゴリ: 直近2週間に記録がないが過去には記録があるカテゴリを優先
    const dormant = await this.ds.query<{ name: string }[]>(
      `SELECT c.name
       FROM categories c
       JOIN daily_record_items ri ON ri.category_id = c.id
       JOIN daily_records r ON r.id = ri.record_id
       WHERE c.user_id = $1 AND c.is_active = true
       GROUP BY c.id, c.name
       HAVING MAX(r.recorded_date) < CURRENT_DATE - INTERVAL '14 days'
       ORDER BY MAX(r.recorded_date) DESC
       LIMIT 1`,
      [userId],
    );

    let suggestedName = dormant[0]?.name;
    if (!suggestedName) {
      const untouched = await this.ds.query<{ name: string }[]>(
        `SELECT c.name
         FROM categories c
         LEFT JOIN daily_record_items ri ON ri.category_id = c.id
         WHERE c.user_id = $1 AND c.is_active = true AND ri.id IS NULL
         LIMIT 1`,
        [userId],
      );
      suggestedName = untouched[0]?.name;
    }

    const base = `いま、あなたの心は「${top.categoryName}」が大きく支えてくれています。それ自体は素敵なことです。もう1本、小さな柱を育てておくと、心はもっと安定します。`;
    const message = suggestedName
      ? `${base}最近ごぶさたの「${suggestedName}」に、今週すこしだけ触れてみませんか？`
      : base;

    return {
      exists: true,
      topCategoryName: top.categoryName,
      topPercentage: top.percentage,
      suggestedCategoryName: suggestedName,
      message,
    };
  }

  private calcDiversityScore(items: PortfolioBreakdownItem[]): number {
    if (items.length === 0) return 0;
    const hhi = items.reduce((sum, i) => {
      const share = i.percentage / 100;
      return sum + share * share;
    }, 0);
    return Math.round((1 - hhi) * 100);
  }
}
