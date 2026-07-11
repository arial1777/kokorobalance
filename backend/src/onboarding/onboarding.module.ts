import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BaselineAssessment } from './baseline-assessment.entity';
import { Category } from '../categories/category.entity';
import { OnboardingService } from './onboarding.service';
import { OnboardingController } from './onboarding.controller';

@Module({
  imports: [TypeOrmModule.forFeature([BaselineAssessment, Category])],
  providers: [OnboardingService],
  controllers: [OnboardingController],
  exports: [TypeOrmModule],
})
export class OnboardingModule {}
