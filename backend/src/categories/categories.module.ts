import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from './category.entity';
import { PresetCategory } from './preset-category.entity';
import { CategoriesService } from './categories.service';
import { CategoriesController } from './categories.controller';
import { ProfileModule } from '../profile/profile.module';

@Module({
  imports: [TypeOrmModule.forFeature([Category, PresetCategory]), ProfileModule],
  providers: [CategoriesService],
  controllers: [CategoriesController],
  exports: [CategoriesService, TypeOrmModule],
})
export class CategoriesModule {}
