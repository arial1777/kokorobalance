import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Subscription } from './subscription.entity';
import { Profile } from '../profile/profile.entity';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [TypeOrmModule.forFeature([Subscription, Profile]), AnalyticsModule],
  providers: [PaymentsService],
  controllers: [PaymentsController],
  exports: [PaymentsService],
})
export class PaymentsModule {}
