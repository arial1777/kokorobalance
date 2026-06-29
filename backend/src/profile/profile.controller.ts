import { Body, Controller, Get, Patch, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProfileService } from './profile.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  getProfile(@Request() req: any) {
    return this.profileService.findOrCreate(req.user.id, req.user.email);
  }

  @Patch()
  updateProfile(@Request() req: any, @Body() dto: UpdateProfileDto) {
    return this.profileService.update(req.user.id, dto);
  }

  @Patch('onboarding')
  completeOnboarding(@Request() req: any) {
    return this.profileService.completeOnboarding(req.user.id);
  }
}
