import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { statusOf } from '../categories/pillar.types';
import type { PillarKind, PillarStatus } from '../categories/pillar.types';

export interface PortfolioBreakdownItem {
  categoryName: string;
  parentName: string;
  totalScore: number;
  percentage: number;
  color: string;
}

export interface CategoryStage {
  name: string;
  color: string;
  kind: PillarKind;
  status: PillarStatus;
  /** 直近の点検（最大4回）のうち選ばれた回数 */
  selectionCount: number;
}

export interface PillarItem {
  categoryId: string;
  categoryName: string;
  color: string;
  kind: PillarKind;
  status: PillarStatus;
  /** 直近の点検（最大4回）のうち選ばれた回数 */
  activeWeeks: number;
}

/**
 * 柱を状態ごとに分けて返す（07-spec-pillars.md §3.5 P-02）。
 * 合計値は持たせない。「N本」という総数をUIの主役にしないため。
 */
export interface PortfolioPillars {
  verified: PillarItem[];
  growing: PillarItem[];
  habits: PillarItem[];
}

export interface PortfolioFulfillment {
  /** 期間内の合計ポイント（充足度・絶対量） */
  total: number;
  weeklyTrend: { weekStart: string; total: number }[];
}

export interface PortfolioResult {
  periodDays: number;
  breakdown: PortfolioBreakdownItem[];
  fulfillment: PortfolioFulfillment;
  pillars: PortfolioPillars;
  /** 内部指標（1 - HHI）。UIの主役にはしない */
  diversityScore: number;
  /** 完了した週次点検の回数 */
  totalRecordDays: number;
  /** オンボーディング診断をブレンド中か（点検4回未満） */
  isBlended: boolean;
}

/** 診断データを実データへ完全移行するまでの点検回数（06-spec-weekly-check.md W-11と統一） */
const BLEND_FULL_CHECKS = 4;

/** 柱ステージの判定に見る直近の点検回数 */
const RECENT_CHECKS_WINDOW = 4;
/** このうち直近何回に選ばれていれば「いま有効」とみなすか */
const RECENT_ACTIVE_WINDOW = 2;

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
              SUM(wce.level) AS total_score
       FROM weekly_check_entries wce
       JOIN weekly_checks wc ON wc.id = wce.weekly_check_id
       JOIN categories c ON c.id = wce.category_id
       WHERE wc.user_id = $1
         AND wc.week_start >= CURRENT_DATE - ($2 || ' days')::INTERVAL
       GROUP BY c.id, c.name, c.parent_name, c.color
       ORDER BY total_score DESC`,
      [userId, periodDays],
    );

    const checkCountRow = await this.ds.query<{ count: string }[]>(
      `SELECT COUNT(*) AS count FROM weekly_checks
       WHERE user_id = $1 AND week_start >= CURRENT_DATE - ($2 || ' days')::INTERVAL`,
      [userId, periodDays],
    );

    // ブレンドの判定は期間によらず「これまでの点検」で行う
    const overallRow = await this.ds.query<{ checks: string }[]>(
      `SELECT COUNT(*) AS checks FROM weekly_checks WHERE user_id = $1`,
      [userId],
    );
    const overallChecks = Number(overallRow[0]?.checks ?? 0);
    const blendWeight = Math.max(0, (BLEND_FULL_CHECKS - overallChecks) / BLEND_FULL_CHECKS);

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

    return {
      periodDays,
      breakdown,
      fulfillment,
      pillars,
      diversityScore: this.calcDiversityScore(breakdown),
      totalRecordDays: Number(checkCountRow[0]?.count ?? 0),
      isBlended,
    };
  }

  /**
   * シェア% = (1 - w)・実データシェア + w・診断シェア
   * 実データが無いうちは診断シェアのみ。点検4回でw=0となり実データへ完全移行。
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
   * 有効な柱ごとに、型（kind）と承認状態（status）、直近の点検で選ばれた回数を返す（07-spec-pillars.md §3.1）。
   *
   * 状態は「点検にどれだけ出てきたか」ではなく `kind` と `verified_at` で決まる。
   * 承認・降格そのものは PillarsService が週次点検の保存時に再計算する。
   * shake.service.ts の備え生成・支えリストでも共有利用する。
   */
  async getCategoryStages(userId: string): Promise<Map<string, CategoryStage>> {
    const categories = await this.ds.query<
      { id: string; name: string; color: string; kind: PillarKind; verified_at: Date | null }[]
    >(
      `SELECT id, name, color, kind, verified_at
         FROM categories
        WHERE user_id = $1 AND is_active = true`,
      [userId],
    );
    if (categories.length === 0) return new Map();

    const checks = await this.ds.query<{ id: string }[]>(
      `SELECT id FROM weekly_checks
        WHERE user_id = $1 ORDER BY week_start DESC LIMIT $2`,
      [userId, RECENT_CHECKS_WINDOW],
    );

    const counts = new Map<string, number>();
    if (checks.length > 0) {
      const rows = await this.ds.query<{ category_id: string; count: string }[]>(
        `SELECT category_id, COUNT(*) AS count
           FROM weekly_check_entries
          WHERE weekly_check_id = ANY($1)
          GROUP BY category_id`,
        [checks.map((c) => c.id)],
      );
      for (const r of rows) counts.set(r.category_id, Number(r.count));
    }

    const result = new Map<string, CategoryStage>();
    for (const c of categories) {
      result.set(c.id, {
        name: c.name,
        color: c.color,
        kind: c.kind,
        status: statusOf(c.kind, c.verified_at),
        selectionCount: counts.get(c.id) ?? 0,
      });
    }
    return result;
  }

  async getPillars(userId: string): Promise<PortfolioPillars> {
    const stages = await this.getCategoryStages(userId);
    const items: PillarItem[] = [...stages.entries()].map(([id, s]) => ({
      categoryId: id,
      categoryName: s.name,
      color: s.color,
      kind: s.kind,
      status: s.status,
      activeWeeks: s.selectionCount,
    }));
    items.sort((a, b) => b.activeWeeks - a.activeWeeks);

    return {
      verified: items.filter((i) => i.status === 'verified'),
      growing: items.filter((i) => i.status === 'growing'),
      habits: items.filter((i) => i.status === 'habit'),
    };
  }

  private async buildFulfillment(
    userId: string,
    periodDays: number,
    actual: CategoryPoint[],
  ): Promise<PortfolioFulfillment> {
    const rows = await this.ds.query<{ week_start: string; total: string }[]>(
      `SELECT wc.week_start::text AS week_start, SUM(wce.level) AS total
       FROM weekly_check_entries wce
       JOIN weekly_checks wc ON wc.id = wce.weekly_check_id
       WHERE wc.user_id = $1
         AND wc.week_start >= CURRENT_DATE - ($2 || ' days')::INTERVAL
       GROUP BY wc.week_start
       ORDER BY wc.week_start`,
      [userId, periodDays],
    );

    return {
      total: actual.reduce((s, a) => s + a.points, 0),
      weeklyTrend: rows.map((r) => ({ weekStart: r.week_start, total: Number(r.total) })),
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
