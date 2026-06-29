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

export interface PortfolioAlert {
  exists: boolean;
  categoryName?: string;
  percentage?: number;
  message?: string;
}

export interface PortfolioResult {
  periodDays: number;
  breakdown: PortfolioBreakdownItem[];
  diversityScore: number;
  alert: PortfolioAlert;
  totalRecordDays: number;
}

@Injectable()
export class PortfolioService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async getPortfolio(userId: string, periodDays: number): Promise<PortfolioResult> {
    const rows = await this.ds.query<
      { name: string; parent_name: string; color: string; total_score: string }[]
    >(
      `SELECT c.name, c.parent_name, c.color,
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

    const grandTotal = rows.reduce((s, r) => s + Number(r.total_score), 0);

    const breakdown: PortfolioBreakdownItem[] = rows.map((r) => ({
      categoryName: r.name,
      parentName: r.parent_name,
      totalScore: Number(r.total_score),
      percentage: grandTotal > 0 ? Math.round((Number(r.total_score) / grandTotal) * 1000) / 10 : 0,
      color: r.color,
    }));

    const diversityScore = this.calcDiversityScore(breakdown);
    const alert = this.buildAlert(breakdown);

    return {
      periodDays,
      breakdown,
      diversityScore,
      alert,
      totalRecordDays: Number(totalDaysRow[0]?.count ?? 0),
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

  private buildAlert(items: PortfolioBreakdownItem[]): PortfolioAlert {
    const top = items[0];
    if (!top || top.percentage < 60) return { exists: false };
    return {
      exists: true,
      categoryName: top.categoryName,
      percentage: top.percentage,
      message: `${top.categoryName}への依存が高くなっています（${top.percentage}%）。もし${top.categoryName}が不安定になると心が大きく揺れる可能性があります。別の楽しみを育てましょう。`,
    };
  }
}
