import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CoachService } from './coach.service';
import { ChatDto } from './dto/chat.dto';

@Controller('coach')
@UseGuards(SupabaseAuthGuard)
export class CoachController {
  constructor(private readonly service: CoachService) {}

  @Get('messages')
  getMessages(@Request() req: any) {
    return this.service.getMessages(req.user.id);
  }

  @Get('quota')
  getQuota(@Request() req: any) {
    return this.service.getQuota(req.user.id);
  }

  @Post('chat')
  chat(@Request() req: any, @Body() dto: ChatDto) {
    return this.service.chat(req.user.id, dto.message);
  }

  @Post('reset')
  resetThread(@Request() req: any) {
    return this.service.resetThread(req.user.id);
  }

  @Post('messages/:id/report')
  reportOffBase(@Request() req: any, @Param('id') id: string) {
    return this.service.reportOffBase(req.user.id, id);
  }
}
