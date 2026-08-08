import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import { SafetyService } from './safety.service';
import type { SafetyCategory } from './safety.types';

@Controller('safety')
@UseGuards(SupabaseAuthGuard)
export class SafetyController {
  constructor(private readonly service: SafetyService) {}

  /** 過去メッセージの再表示など、判定に紐づかない文脈で窓口一覧を出す場合に使う */
  @Get('hotlines')
  getHotlines(@Query('category') category?: SafetyCategory) {
    return this.service.getHotlines(category ?? null);
  }
}
