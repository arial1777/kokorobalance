import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from './category.entity';
import { PillarsService } from './pillars.service';
import { AnalyticsModule } from '../analytics/analytics.module';

/**
 * 承認エンジン（07-spec-pillars.md §3）だけを持つモジュール。
 * CategoriesModule から切り離してあるのは、CategoriesService が ProfileService に依存する一方で
 * PillarsService は Category しか触らないため。退会処理（ProfileService → PairService →
 * 柱の再評価）で循環参照になるのを避ける。
 */
@Module({
  imports: [TypeOrmModule.forFeature([Category]), AnalyticsModule],
  providers: [PillarsService],
  exports: [PillarsService, TypeOrmModule],
})
export class PillarsModule {}
