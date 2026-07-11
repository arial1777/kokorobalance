import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(SupabaseAuthGuard)
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get()
  getReports(@Request() req: any) {
    return this.service.getReports(req.user.id);
  }

  @Get(':weekStartDate')
  getReport(@Request() req: any, @Param('weekStartDate') date: string) {
    return this.service.getReport(req.user.id, date);
  }

  @Post('generate')
  generate(@Request() req: any, @Body('weekStartDate') date?: string) {
    return this.service.generateReport(req.user.id, date);
  }
}
