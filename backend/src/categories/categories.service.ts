import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Category } from './category.entity';
import { PresetCategory } from './preset-category.entity';
import { BulkActivateCategoriesDto, CreateCategoryDto, UpdateCategoryDto } from './dto/create-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
    @InjectRepository(PresetCategory)
    private readonly presetRepo: Repository<PresetCategory>,
  ) {}

  getPresets(): Promise<PresetCategory[]> {
    return this.presetRepo.find({ order: { sortOrder: 'ASC' } });
  }

  getUserCategories(userId: string): Promise<Category[]> {
    return this.categoryRepo.find({
      where: { userId },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  async bulkActivate(userId: string, dto: BulkActivateCategoriesDto): Promise<Category[]> {
    const presets = await this.presetRepo.findBy({ id: In(dto.presetIds) });
    const entities = presets.map((p: PresetCategory) =>
      this.categoryRepo.create({
        userId,
        name: p.name,
        parentName: p.parentName,
        color: p.color,
        isPreset: true,
        sortOrder: p.sortOrder,
      }),
    );
    return this.categoryRepo.save(entities);
  }

  async create(userId: string, dto: CreateCategoryDto): Promise<Category> {
    const entity = this.categoryRepo.create({
      userId,
      name: dto.name,
      parentName: dto.parentName,
      color: dto.color ?? '#6B7280',
      isPreset: false,
    });
    return this.categoryRepo.save(entity);
  }

  async update(userId: string, id: string, dto: UpdateCategoryDto): Promise<Category> {
    const category = await this.categoryRepo.findOne({ where: { id, userId } });
    if (!category) throw new NotFoundException('カテゴリが見つかりません');
    Object.assign(category, dto);
    return this.categoryRepo.save(category);
  }

  async remove(userId: string, id: string): Promise<void> {
    const category = await this.categoryRepo.findOne({
      where: { id, userId },
      relations: { recordItems: true },
    });
    if (!category) throw new NotFoundException('カテゴリが見つかりません');

    if (category.recordItems && category.recordItems.length > 0) {
      await this.categoryRepo.update(id, { isActive: false });
    } else {
      await this.categoryRepo.delete(id);
    }
  }
}
