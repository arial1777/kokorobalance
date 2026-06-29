import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Repository } from 'typeorm';
import { WeeklyReport } from './weekly-report.entity';
import { PortfolioService } from '../portfolio/portfolio.service';
import { Profile } from '../profile/profile.entity';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(WeeklyReport)
    private readonly reportRepo: Repository<WeeklyReport>,
    @InjectRepository(Profile)
    private readonly profileRepo: Repository<Profile>,
    private readonly portfolioService: PortfolioService,
  ) {}

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

  async generateReport(userId: string, weekStartDate?: string): Promise<WeeklyReport> {
    const monday = weekStartDate ?? this.getLastMonday();
    const portfolio = await this.portfolioService.getPortfolio(userId, 7);

    const breakdown: Record<string, number> = {};
    portfolio.breakdown.forEach((b) => {
      breakdown[b.categoryName] = b.percentage;
    });

    const existing = await this.reportRepo.findOne({
      where: { userId, weekStartDate: monday as any },
    });

    const data = {
      userId,
      weekStartDate: monday,
      categoryBreakdown: breakdown,
      totalScore: portfolio.breakdown.reduce((s, b) => s + b.totalScore, 0),
      diversityScore: portfolio.diversityScore,
    };

    if (existing) {
      await this.reportRepo.update(existing.id, data);
      return this.reportRepo.findOneOrFail({ where: { id: existing.id } });
    }
    return this.reportRepo.save(this.reportRepo.create(data));
  }

  @Cron('0 0 * * 1', { timeZone: 'Asia/Tokyo' }) // 毎週月曜 0:00 JST
  async generateWeeklyReportsForAll(): Promise<void> {
    const profiles = await this.profileRepo.find();
    const monday = this.getLastMonday();
    await Promise.allSettled(
      profiles.map((p) => this.generateReport(p.id, monday)),
    );
  }

  private getLastMonday(): string {
    const today = new Date();
    const day = today.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diff);
    return monday.toISOString().split('T')[0];
  }
}
