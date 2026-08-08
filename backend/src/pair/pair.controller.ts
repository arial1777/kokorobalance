import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Request, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { PairService } from './pair.service';
import { AcceptInviteDto, RequestVerificationDto, RespondToRequestDto } from './dto/pair.dto';

/**
 * ペア（09-spec-pair.md）。
 * **ユーザー検索・メッセージ送信・リマインド送信のエンドポイントは意図的に存在しない**
 * （PR-A-02 / PR-A-06、§5）。
 */
@Controller('pair')
@UseGuards(SupabaseAuthGuard)
export class PairController {
  constructor(private readonly service: PairService) {}

  @Get()
  getPair(@Request() req: any) {
    return this.service.getPairView(req.user.id);
  }

  @Post('invite')
  createInvite(@Request() req: any) {
    return this.service.createInvite(req.user.id);
  }

  @Delete('invite')
  revokeInvite(@Request() req: any) {
    return this.service.revokeInvite(req.user.id);
  }

  @Post('accept')
  accept(@Request() req: any, @Body() dto: AcceptInviteDto) {
    return this.service.acceptInvite(req.user.id, dto.code);
  }

  @Post('pause')
  pause(@Request() req: any) {
    return this.service.pause(req.user.id);
  }

  @Post('resume')
  resume(@Request() req: any) {
    return this.service.resume(req.user.id);
  }

  @Delete()
  end(@Request() req: any) {
    return this.service.end(req.user.id);
  }

  @Post('requests')
  requestVerification(@Request() req: any, @Body() dto: RequestVerificationDto) {
    return this.service.requestVerification(req.user.id, dto.categoryId);
  }

  @Post('requests/:id/respond')
  respond(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RespondToRequestDto,
  ) {
    return this.service.respondToRequest(req.user.id, id, dto.answer);
  }
}
