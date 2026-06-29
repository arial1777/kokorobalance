import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProPlanGuard } from '../auth/pro-plan.guard';
import { CoachService } from './coach.service';
import { ChatDto } from './dto/chat.dto';

@Controller('coach')
@UseGuards(JwtAuthGuard, ProPlanGuard)
export class CoachController {
  constructor(private readonly service: CoachService) {}

  @Get('messages')
  getMessages(@Request() req: any) {
    return this.service.getMessages(req.user.id);
  }

  @Post('chat')
  chat(@Request() req: any, @Body() dto: ChatDto) {
    return this.service.chat(req.user.id, dto.message);
  }
}
