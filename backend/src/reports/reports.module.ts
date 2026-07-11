import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WeeklyReport } from './weekly-report.entity';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { PortfolioModule } from '../portfolio/portfolio.module';
import { Profile } from '../profile/profile.entity';
import { GeminiModule } from '../common/gemini.module';

@Module({
  imports: [TypeOrmModule.forFeature([WeeklyReport, Profile]), PortfolioModule, GeminiModule],
  providers: [ReportsService],
  controllers: [ReportsController],
  exports: [ReportsService],
})
export class ReportsModule {}
