import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiCoachMessage } from './ai-coach-message.entity';
import { CoachService } from './coach.service';
import { CoachController } from './coach.controller';
import { PortfolioModule } from '../portfolio/portfolio.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([AiCoachMessage]), PortfolioModule, AuthModule],
  providers: [CoachService],
  controllers: [CoachController],
})
export class CoachModule {}
