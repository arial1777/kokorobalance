import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SafetyRule } from './safety-rule.entity';
import { SafetyHotline } from './safety-hotline.entity';
import { SafetyEvent } from './safety-event.entity';
import { SafetyService } from './safety.service';
import { SafetyController } from './safety.controller';
import { GeminiModule } from '../gemini.module';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([SafetyRule, SafetyHotline, SafetyEvent]), GeminiModule, AuthModule],
  providers: [SafetyService],
  controllers: [SafetyController],
  exports: [SafetyService],
})
export class SafetyModule {}
