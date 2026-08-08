import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShakeTemplate } from './shake-template.entity';
import { ShakeEvent } from './shake-event.entity';
import { PrepAction } from './prep-action.entity';
import { ShakeReview } from './shake-review.entity';
import { Category } from '../categories/category.entity';
import { Profile } from '../profile/profile.entity';
import { ShakeService } from './shake.service';
import { ShakeController } from './shake.controller';
import { SafetyModule } from '../common/safety/safety.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { GeminiModule } from '../common/gemini.module';
import { AuthModule } from '../auth/auth.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { PortfolioModule } from '../portfolio/portfolio.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ShakeTemplate, ShakeEvent, PrepAction, ShakeReview, Category, Profile]),
    SafetyModule,
    NotificationsModule,
    GeminiModule,
    AuthModule,
    AnalyticsModule,
    PortfolioModule,
  ],
  providers: [ShakeService],
  controllers: [ShakeController],
  exports: [ShakeService],
})
export class ShakeModule {}
