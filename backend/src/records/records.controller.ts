import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RecordsService } from './records.service';
import { CreateRecordDto } from './dto/create-record.dto';
import { CreateFluctuationDto } from './dto/create-fluctuation.dto';

@Controller('records')
@UseGuards(SupabaseAuthGuard)
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

  // 注意: ':date' より先に宣言しないとパスが ':date' に吸われる
  @Get('fluctuations')
  getFluctuations(
    @Request() req: any,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const today = new Date().toISOString().split('T')[0];
    return this.service.getFluctuations(req.user.id, from ?? '2000-01-01', to ?? today);
  }

  @Post('fluctuations')
  createFluctuation(@Request() req: any, @Body() dto: CreateFluctuationDto) {
    return this.service.createFluctuation(req.user.id, dto);
  }

  @Delete('fluctuations/:id')
  @HttpCode(204)
  async deleteFluctuation(@Request() req: any, @Param('id') id: string) {
    await this.service.deleteFluctuation(req.user.id, id);
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
