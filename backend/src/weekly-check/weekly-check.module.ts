import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WeeklyCheck } from './weekly-check.entity';
import { WeeklyCheckEntry } from './weekly-check-entry.entity';
import { Category } from '../categories/category.entity';
import { Profile } from '../profile/profile.entity';
import { WeeklyCheckService } from './weekly-check.service';
import { WeeklyCheckController } from './weekly-check.controller';
import { SafetyModule } from '../common/safety/safety.module';
import { PortfolioModule } from '../portfolio/portfolio.module';
import { ReportsModule } from '../reports/reports.module';
import { AuthModule } from '../auth/auth.module';
import { PillarsModule } from '../categories/pillars.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WeeklyCheck, WeeklyCheckEntry, Category, Profile]),
    SafetyModule,
    PortfolioModule,
    ReportsModule,
    AuthModule,
    PillarsModule,
  ],
  providers: [WeeklyCheckService],
  controllers: [WeeklyCheckController],
  exports: [WeeklyCheckService],
})
export class WeeklyCheckModule {}
