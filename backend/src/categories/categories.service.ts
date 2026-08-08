import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { Category } from './category.entity';
import { PresetCategory } from './preset-category.entity';
import {
  BulkActivateCategoriesDto,
  BulkCreateCategoriesDto,
  CreateCategoryDto,
  UpdateCategoryDto,
} from './dto/create-category.dto';
import { ProfileService } from '../profile/profile.service';
import { SafetyService } from '../common/safety/safety.service';
import { AnalyticsService } from '../analytics/analytics.service';

/** 有効な柱の上限（07-spec-pillars.md P-15）。これ以上は管理不能になる */
export const MAX_ACTIVE_PILLARS = 30;

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
    @InjectRepository(PresetCategory)
    private readonly presetRepo: Repository<PresetCategory>,
    private readonly profileService: ProfileService,
    private readonly safety: SafetyService,
    private readonly analytics: AnalyticsService,
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

  async bulkActivate(userId: string, email: string, dto: BulkActivateCategoriesDto): Promise<Category[]> {
    await this.profileService.findOrCreate(userId, email);
    const existing = await this.categoryRepo.find({ where: { userId } });
    const existingKeys = new Set(existing.map((c) => `${c.name}::${c.parentName}`));

    const presets = await this.presetRepo.findBy({ id: In(dto.presetIds) });
    const newPresets = presets.filter((p) => !existingKeys.has(`${p.name}::${p.parentName}`));
    await this.assertCapacity(userId, newPresets.length);

    const entities = newPresets.map((p: PresetCategory) =>
      this.categoryRepo.create({
        userId,
        name: p.name,
        parentName: p.parentName,
        color: p.color,
        kind: p.kind,
        isPreset: true,
        sortOrder: p.sortOrder,
      }),
    );
    const created = await this.categoryRepo.save(entities);
    return [...existing.filter((c) => presets.some((p) => `${p.name}::${p.parentName}` === `${c.name}::${c.parentName}`)), ...created];
  }

  async create(userId: string, email: string, dto: CreateCategoryDto): Promise<Category> {
    await this.profileService.findOrCreate(userId, email);
    await this.assertCapacity(userId, 1);
    // ラベルもセーフティ判定を通す（07 P-14）。検知はSafetyService側で監査記録される
    await this.safety.evaluate(dto.name, 'pillar_label', userId);

    const entity = this.categoryRepo.create({
      userId,
      name: dto.name,
      parentName: dto.parentName,
      color: dto.color ?? '#6B7280',
      kind: dto.kind ?? 'habit',
      importance: dto.importance ?? 2,
      isFragile: dto.isFragile ?? false,
      isPreset: false,
    });
    const saved = await this.categoryRepo.save(entity);
    // 11 §5「柱の新規追加率」。**ラベルは送らず kind だけ**（ME-02）
    await this.analytics.track(userId, 'pillar_added', { kind: saved.kind });
    return saved;
  }

  /** オンボーディングで柱をまとめて登録する（07 §4.1） */
  async bulkCreate(userId: string, email: string, dto: BulkCreateCategoriesDto): Promise<Category[]> {
    await this.profileService.findOrCreate(userId, email);
    await this.assertCapacity(userId, dto.pillars.length);
    await Promise.all(dto.pillars.map((p) => this.safety.evaluate(p.name, 'pillar_label', userId)));

    const entities = dto.pillars.map((p, i) =>
      this.categoryRepo.create({
        userId,
        name: p.name,
        parentName: p.parentName,
        color: p.color ?? '#6B7280',
        kind: p.kind ?? 'habit',
        importance: p.importance ?? 2,
        isFragile: p.isFragile ?? false,
        isPreset: false,
        sortOrder: i,
      }),
    );
    const saved = await this.categoryRepo.save(entities);
    // 11 §3.1 のオンボファネル。社会的な柱（居場所・相手）の件数を併せて見る
    await this.analytics.track(userId, 'onboarding_pillars_saved', {
      count: saved.length,
      socialCount: saved.filter((c) => c.kind !== 'habit').length,
    });
    return saved;
  }

  async update(userId: string, id: string, dto: UpdateCategoryDto): Promise<Category> {
    const category = await this.categoryRepo.findOne({ where: { id, userId } });
    if (!category) throw new NotFoundException('柱が見つかりません');
    if (dto.name && dto.name !== category.name) {
      await this.safety.evaluate(dto.name, 'pillar_label', userId);
    }
    // 再有効化で上限を超えないようにする
    if (dto.isActive === true && !category.isActive) {
      await this.assertCapacity(userId, 1);
    }

    Object.assign(category, dto);
    // 習慣は承認の対象外。型を習慣に変えたら承認を落とす（02 §2.2 の不変条件）
    if (category.kind === 'habit') {
      category.verifiedAt = null;
      category.verificationSource = null;
    }
    return this.categoryRepo.save(category);
  }

  async remove(userId: string, id: string): Promise<void> {
    const category = await this.categoryRepo.findOne({
      where: { id, userId },
      relations: { recordItems: true },
    });
    if (!category) throw new NotFoundException('柱が見つかりません');

    // 過去のふりかえり・支えリストが参照するため、参照があれば論理削除にとどめる（07 §4.3）
    if (category.recordItems && category.recordItems.length > 0) {
      await this.categoryRepo.update(id, { isActive: false });
      return;
    }
    const referenced = await this.categoryRepo.manager.query<{ exists: boolean }[]>(
      `SELECT EXISTS (SELECT 1 FROM weekly_check_entries WHERE category_id = $1) AS exists`,
      [id],
    );
    if (referenced[0]?.exists) {
      await this.categoryRepo.update(id, { isActive: false });
    } else {
      await this.categoryRepo.delete(id);
    }
  }

  private async assertCapacity(userId: string, adding: number): Promise<void> {
    if (adding <= 0) return;
    const active = await this.categoryRepo.count({ where: { userId, isActive: true } });
    if (active + adding > MAX_ACTIVE_PILLARS) {
      throw new ForbiddenException('柱が多すぎると見えなくなります。いくつか整理してから追加してください');
    }
  }
}
