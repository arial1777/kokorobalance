import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { OnboardingService } from './onboarding.service';
import { SaveBaselineDto } from './dto/save-baseline.dto';

@Controller('onboarding')
@UseGuards(SupabaseAuthGuard)
export class OnboardingController {
  constructor(private readonly service: OnboardingService) {}

  @Post('baseline')
  saveBaseline(@Request() req: any, @Body() dto: SaveBaselineDto) {
    return this.service.saveBaseline(req.user.id, dto);
  }

  @Get('baseline')
  getBaseline(@Request() req: any) {
    return this.service.getBaseline(req.user.id);
  }
}
