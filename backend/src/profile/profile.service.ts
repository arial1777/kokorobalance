import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Profile } from './profile.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class ProfileService {
  constructor(
    @InjectRepository(Profile)
    private readonly repo: Repository<Profile>,
  ) {}

  async findOrCreate(userId: string, email: string): Promise<Profile> {
    let profile = await this.repo.findOne({ where: { id: userId } });
    if (!profile) {
      profile = this.repo.create({
        id: userId,
        nickname: email.split('@')[0],
      });
      await this.repo.save(profile);
    }
    return profile;
  }

  async update(userId: string, dto: UpdateProfileDto): Promise<Profile> {
    await this.repo.update(userId, {
      ...(dto.nickname && { nickname: dto.nickname }),
      ...(dto.reminderTime !== undefined && { reminderTime: dto.reminderTime }),
    });
    return this.repo.findOneOrFail({ where: { id: userId } });
  }

  async completeOnboarding(userId: string): Promise<void> {
    await this.repo.update(userId, { onboardingCompleted: true });
  }
}
