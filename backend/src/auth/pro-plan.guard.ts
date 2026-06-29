import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Profile } from '../profile/profile.entity';

@Injectable()
export class ProPlanGuard implements CanActivate {
  constructor(
    @InjectRepository(Profile)
    private readonly profileRepo: Repository<Profile>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const user = context.switchToHttp().getRequest().user;
    const profile = await this.profileRepo.findOne({ where: { id: user.id } });
    if (!profile || profile.plan !== 'pro') {
      throw new ForbiddenException('この機能はProプランが必要です');
    }
    return true;
  }
}
