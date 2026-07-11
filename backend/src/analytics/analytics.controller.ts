import { Body, Controller, HttpCode, Post, Request, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { AnalyticsService } from './analytics.service';
import { TrackEventDto } from './dto/track-event.dto';

@Controller('events')
@UseGuards(SupabaseAuthGuard)
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  @Post()
  @HttpCode(204)
  async track(@Request() req: any, @Body() dto: TrackEventDto) {
    await this.service.track(req.user.id, dto.eventName, dto.properties ?? {});
  }
}
