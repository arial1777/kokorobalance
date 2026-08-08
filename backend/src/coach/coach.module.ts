import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiCoachMessage } from './ai-coach-message.entity';
import { AiUsage } from './ai-usage.entity';
import { CoachService } from './coach.service';
import { CoachController } from './coach.controller';
import { PortfolioModule } from '../portfolio/portfolio.module';
import { AuthModule } from '../auth/auth.module';
import { Profile } from '../profile/profile.entity';
import { GeminiModule } from '../common/gemini.module';
import { SafetyModule } from '../common/safety/safety.module';
import { ShakeModule } from '../shake/shake.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AiCoachMessage, AiUsage, Profile]),
    PortfolioModule,
    AuthModule,
    GeminiModule,
    SafetyModule,
    ShakeModule,
  ],
  providers: [CoachService],
  controllers: [CoachController],
})
export class CoachModule {}
