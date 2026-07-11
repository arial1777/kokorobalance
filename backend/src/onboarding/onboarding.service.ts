import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { BaselineAssessment } from './baseline-assessment.entity';
import { Category } from '../categories/category.entity';
import { SaveBaselineDto } from './dto/save-baseline.dto';

@Injectable()
export class OnboardingService {
  constructor(
    @InjectRepository(BaselineAssessment)
    private readonly baselineRepo: Repository<BaselineAssessment>,
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
  ) {}

  async saveBaseline(userId: string, dto: SaveBaselineDto): Promise<{ saved: number }> {
    const categoryIds = dto.items.map((i) => i.categoryId);
    const owned = await this.categoryRepo.countBy({ id: In(categoryIds), userId });
    if (owned !== categoryIds.length) {
      throw new BadRequestException('自分のカテゴリのみ診断できます');
    }

    await this.baselineRepo.upsert(
      dto.items.map((i) => ({
        userId,
        categoryId: i.categoryId,
        level: i.level as 1 | 2 | 3,
      })),
      ['userId', 'categoryId'],
    );

    return { saved: dto.items.length };
  }

  getBaseline(userId: string): Promise<BaselineAssessment[]> {
    return this.baselineRepo.find({
      where: { userId },
      relations: { category: true },
    });
  }
}
