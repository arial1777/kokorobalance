import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CronAuthGuard } from '../auth/cron-auth.guard';
import { ShakeService } from './shake.service';
import { CreateShakeEventDto } from './dto/create-shake-event.dto';
import { UpdateShakeEventDto } from './dto/update-shake-event.dto';
import { CreatePrepActionDto } from './dto/create-prep-action.dto';
import { CreateShakeReviewDto } from './dto/create-shake-review.dto';

@Controller('shake')
export class ShakeController {
  constructor(private readonly service: ShakeService) {}

  @Get('templates')
  @UseGuards(SupabaseAuthGuard)
  getTemplates() {
    return this.service.getTemplates();
  }

  @Get('events')
  @UseGuards(SupabaseAuthGuard)
  getEvents(@Request() req: any, @Query('status') status?: string) {
    return this.service.getEvents(req.user.id, status);
  }

  @Get('events/:id')
  @UseGuards(SupabaseAuthGuard)
  getEventDetail(@Request() req: any, @Param('id') id: string) {
    return this.service.getEventDetail(req.user.id, id);
  }

  @Post('events')
  @UseGuards(SupabaseAuthGuard)
  createEvent(@Request() req: any, @Body() dto: CreateShakeEventDto) {
    return this.service.createEvent(req.user.id, dto);
  }

  @Patch('events/:id')
  @UseGuards(SupabaseAuthGuard)
  updateEvent(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateShakeEventDto) {
    return this.service.updateEvent(req.user.id, id, dto);
  }

  @Delete('events/:id')
  @HttpCode(204)
  @UseGuards(SupabaseAuthGuard)
  async archiveEvent(@Request() req: any, @Param('id') id: string) {
    await this.service.archiveEvent(req.user.id, id);
  }

  @Post('events/:id/preps')
  @UseGuards(SupabaseAuthGuard)
  createUserPrep(@Request() req: any, @Param('id') id: string, @Body() dto: CreatePrepActionDto) {
    return this.service.createUserPrep(req.user.id, id, dto);
  }

  @Post('events/:id/preps/:prepId/accept')
  @UseGuards(SupabaseAuthGuard)
  acceptPrep(@Request() req: any, @Param('id') id: string, @Param('prepId') prepId: string) {
    return this.service.acceptPrep(req.user.id, id, prepId);
  }

  @Post('events/:id/preps/:prepId/done')
  @UseGuards(SupabaseAuthGuard)
  completePrep(@Request() req: any, @Param('id') id: string, @Param('prepId') prepId: string) {
    return this.service.completePrep(req.user.id, id, prepId);
  }

  @Post('events/:id/preps/:prepId/skip')
  @UseGuards(SupabaseAuthGuard)
  skipPrep(@Request() req: any, @Param('id') id: string, @Param('prepId') prepId: string) {
    return this.service.skipPrep(req.user.id, id, prepId);
  }

  @Post('events/:id/review')
  @UseGuards(SupabaseAuthGuard)
  createReview(@Request() req: any, @Param('id') id: string, @Body() dto: CreateShakeReviewDto) {
    return this.service.createReview(req.user.id, id, dto);
  }

  /** Cloud Schedulerから毎時叩かれるバッチの起動口 */
  @Post('cron/tick')
  @UseGuards(CronAuthGuard)
  @HttpCode(200)
  runTick() {
    return this.service.tick();
  }
}
