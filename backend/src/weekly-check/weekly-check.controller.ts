import { Body, Controller, Get, Put, Request, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { WeeklyCheckService } from './weekly-check.service';
import { UpsertWeeklyCheckDto } from './dto/upsert-weekly-check.dto';

@Controller('weekly-check')
@UseGuards(SupabaseAuthGuard)
export class WeeklyCheckController {
  constructor(private readonly service: WeeklyCheckService) {}

  @Get('current')
  getCurrent(@Request() req: any) {
    return this.service.getCurrent(req.user.id);
  }

  @Put()
  upsert(@Request() req: any, @Body() dto: UpsertWeeklyCheckDto) {
    return this.service.upsert(req.user.id, dto);
  }
}
