import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventLog } from './event-log.entity';
import { Profile } from '../profile/profile.entity';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';

@Module({
  imports: [TypeOrmModule.forFeature([EventLog, Profile])],
  providers: [AnalyticsService],
  controllers: [AnalyticsController],
  exports: [AnalyticsService, TypeOrmModule],
})
export class AnalyticsModule {}
