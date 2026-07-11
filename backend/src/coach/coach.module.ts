import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiCoachMessage } from './ai-coach-message.entity';
import { AiUsage } from './ai-usage.entity';
import { CoachService } from './coach.service';
import { CoachController } from './coach.controller';
import { CrisisDetectorService } from './crisis-detector.service';
import { PortfolioModule } from '../portfolio/portfolio.module';
import { AuthModule } from '../auth/auth.module';
import { Profile } from '../profile/profile.entity';
import { GeminiModule } from '../common/gemini.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AiCoachMessage, AiUsage, Profile]),
    PortfolioModule,
    AuthModule,
    GeminiModule,
  ],
  providers: [CoachService, CrisisDetectorService],
  controllers: [CoachController],
})
export class CoachModule {}
