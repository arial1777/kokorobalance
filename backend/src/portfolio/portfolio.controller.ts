import { Controller, Get, ParseIntPipe, Query, Request, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { PortfolioService } from './portfolio.service';

@Controller('portfolio')
@UseGuards(SupabaseAuthGuard)
export class PortfolioController {
  constructor(private readonly service: PortfolioService) {}

  @Get()
  getPortfolio(
    @Request() req: any,
    @Query('period') period = '30',
  ) {
    const days = Math.min(Math.max(parseInt(period, 10) || 30, 7), 90);
    return this.service.getPortfolio(req.user.id, days);
  }
}
