import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from './category.entity';
import { PresetCategory } from './preset-category.entity';
import { CategoriesService } from './categories.service';
import { CategoriesController } from './categories.controller';
import { PillarsModule } from './pillars.module';
import { ProfileModule } from '../profile/profile.module';
import { AuthModule } from '../auth/auth.module';
import { SafetyModule } from '../common/safety/safety.module';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Category, PresetCategory]),
    PillarsModule,
    ProfileModule,
    AuthModule,
    SafetyModule,
    AnalyticsModule,
  ],
  providers: [CategoriesService],
  controllers: [CategoriesController],
  exports: [CategoriesService, PillarsModule, TypeOrmModule],
})
export class CategoriesModule {}
