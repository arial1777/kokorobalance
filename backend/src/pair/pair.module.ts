import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pair } from './pair.entity';
import { PillarVerificationRequest } from './pillar-verification-request.entity';
import { Category } from '../categories/category.entity';
import { Profile } from '../profile/profile.entity';
import { PairService } from './pair.service';
import { PairController } from './pair.controller';
import { PortfolioModule } from '../portfolio/portfolio.module';
import { PillarsModule } from '../categories/pillars.module';
import { SafetyModule } from '../common/safety/safety.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Pair, PillarVerificationRequest, Category, Profile]),
    PortfolioModule,
    PillarsModule,
    SafetyModule,
    NotificationsModule,
    AuthModule,
  ],
  providers: [PairService],
  controllers: [PairController],
  exports: [PairService],
})
export class PairModule {}
