import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RecordsService } from './records.service';
import { CreateRecordDto } from './dto/create-record.dto';

@Controller('records')
@UseGuards(JwtAuthGuard)
export class RecordsController {
  constructor(private readonly service: RecordsService) {}

  @Get()
  getRecords(
    @Request() req: any,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const today = new Date().toISOString().split('T')[0];
    return this.service.getRecords(req.user.id, from ?? '2000-01-01', to ?? today);
  }

  @Get(':date')
  getRecordByDate(@Request() req: any, @Param('date') date: string) {
    return this.service.getRecordByDate(req.user.id, date);
  }

  @Post()
  upsertRecord(@Request() req: any, @Body() dto: CreateRecordDto) {
    return this.service.upsert(req.user.id, dto);
  }
}
