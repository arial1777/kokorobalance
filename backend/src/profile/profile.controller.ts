import { Body, Controller, Delete, Get, HttpCode, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ProfileService } from './profile.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';

@Controller('profile')
@UseGuards(SupabaseAuthGuard)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  getProfile(@Request() req: any) {
    return this.profileService.findOrCreate(req.user.id, req.user.email);
  }

  @Get('export')
  exportData(@Request() req: any) {
    return this.profileService.exportData(req.user.id);
  }

  @Patch()
  updateProfile(@Request() req: any, @Body() dto: UpdateProfileDto) {
    return this.profileService.update(req.user.id, dto);
  }

  @Patch('onboarding')
  completeOnboarding(@Request() req: any) {
    return this.profileService.completeOnboarding(req.user.id);
  }

  @Post('ai-consent')
  giveAiConsent(@Request() req: any) {
    return this.profileService.giveAiConsent(req.user.id);
  }

  @Post('push-token')
  registerPushToken(@Request() req: any, @Body() dto: RegisterPushTokenDto) {
    return this.profileService.registerPushToken(req.user.id, dto.token);
  }

  @Delete('push-token')
  @HttpCode(204)
  async clearPushToken(@Request() req: any) {
    await this.profileService.clearPushToken(req.user.id);
  }

  @Delete()
  @HttpCode(204)
  async deleteAccount(@Request() req: any) {
    await this.profileService.deleteAccount(req.user.id);
  }
}
