import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { WeeklyCheck } from './weekly-check.entity';
import { WeeklyCheckEntry } from './weekly-check-entry.entity';
import { Category } from '../categories/category.entity';
import { Profile } from '../profile/profile.entity';
import { UpsertWeeklyCheckDto } from './dto/upsert-weekly-check.dto';
import { SafetyService } from '../common/safety/safety.service';
import { HotlineView, SafetyVerdict } from '../common/safety/safety.types';
import { PortfolioService } from '../portfolio/portfolio.service';
import { ReportsService } from '../reports/reports.service';
import { PillarsService } from '../categories/pillars.service';
import { statusOf } from '../categories/pillar.types';
import type { PillarKind, PillarStatus } from '../categories/pillar.types';

export interface WeeklyCheckCategoryOption {
  id: string;
  name: string;
  parentName: string;
  color: string;
  kind: PillarKind;
  status: PillarStatus;
  selectionCount: number;
}

export interface CurrentWeeklyCheckResult {
  weekStart: string;
  entries: { categoryId: string; level: number }[];
  moodNote: string | null;
  completedAt: string | null;
  categories: WeeklyCheckCategoryOption[];
}

export interface SaveWeeklyCheckResult {
  check: WeeklyCheck;
  safetyVerdict: SafetyVerdict;
  hotlines: HotlineView[];
  /** 確かな柱が0件のまま続いたときに1回だけ出す静かな提示（06 §5.2）。通常は null */
  gentleNudge: string | null;
}

/** 確かな柱が0件のまま続いたときに静かな提示を出す点検回数（06 §5.2） */
const ZERO_PILLAR_NUDGE_CHECKS = 4;

/**
 * 06 §5.2 の唯一の例外。「〜しましょう」ではなく可能性の提示に留める。
 * 育成提案を独立機能として復活させないため、文面はここに固定で持つ。
 */
const ZERO_PILLAR_NUDGE_MESSAGE =
  'もし気が向いたら、昔つながっていた人の名前をひとつ、登録しておくだけでもいいかもしれません。';

@Injectable()
export class WeeklyCheckService {
  constructor(
    @InjectRepository(WeeklyCheck) private readonly checkRepo: Repository<WeeklyCheck>,
    @InjectRepository(WeeklyCheckEntry) private readonly entryRepo: Repository<WeeklyCheckEntry>,
    @InjectRepository(Category) private readonly categoryRepo: Repository<Category>,
    @InjectRepository(Profile) private readonly profileRepo: Repository<Profile>,
    private readonly safety: SafetyService,
    private readonly portfolio: PortfolioService,
    private readonly reports: ReportsService,
    private readonly pillars: PillarsService,
  ) {}

  async getCurrent(userId: string): Promise<CurrentWeeklyCheckResult> {
    const weekStart = this.currentMondayJST();
    const check = await this.checkRepo.findOne({ where: { userId, weekStart }, relations: { entries: true } });

    const categories = await this.categoryRepo.find({ where: { userId, isActive: true } });
    const stages = await this.portfolio.getCategoryStages(userId);
    // 習慣も柱と同じ一覧に並べる。差別的なUIにしない（07 §2.2、P-A-03）
    const categoryOptions: WeeklyCheckCategoryOption[] = categories
      .map((c) => ({
        id: c.id,
        name: c.name,
        parentName: c.parentName,
        color: c.color,
        kind: c.kind,
        status: statusOf(c.kind, c.verifiedAt),
        selectionCount: stages.get(c.id)?.selectionCount ?? 0,
      }))
      .sort((a, b) => b.selectionCount - a.selectionCount);

    return {
      weekStart,
      entries: check?.entries.map((e) => ({ categoryId: e.categoryId, level: e.level })) ?? [],
      moodNote: check?.moodNote ?? null,
      completedAt: check?.completedAt.toISOString() ?? null,
      categories: categoryOptions,
    };
  }

  async upsert(userId: string, dto: UpsertWeeklyCheckDto): Promise<SaveWeeklyCheckResult> {
    const weekStart = dto.weekStart ?? this.currentMondayJST();

    // 1週前までは遡って入力できる。それ以前は不可（06 §2.4 W-08）
    const current = this.currentMondayJST();
    const previous = this.addDays(current, -7);
    if (weekStart !== current && weekStart !== previous) {
      throw new ForbiddenException('点検できるのは今週と先週分のみです');
    }

    if (dto.entries.length > 0) {
      const uniqueIds = Array.from(new Set(dto.entries.map((e) => e.categoryId)));
      const owned = await this.categoryRepo.count({ where: { id: In(uniqueIds), userId } });
      if (owned !== uniqueIds.length) {
        throw new ForbiddenException('指定されたカテゴリが見つかりません');
      }
    }

    let safetyVerdict: SafetyVerdict = 'clear';
    let hotlines: HotlineView[] = [];
    if (dto.moodNote) {
      const evaluation = await this.safety.evaluate(dto.moodNote, 'weekly_check_note', userId);
      safetyVerdict = evaluation.verdict;
      if (evaluation.verdict !== 'clear') hotlines = await this.safety.getHotlines(evaluation.category);
    }

    let check = await this.checkRepo.findOne({ where: { userId, weekStart } });
    const now = new Date();
    if (check) {
      await this.entryRepo.delete({ weeklyCheckId: check.id });
      check.moodNote = dto.moodNote ?? null;
      check.completedAt = now;
      check = await this.checkRepo.save(check);
    } else {
      check = await this.checkRepo.save(
        this.checkRepo.create({ userId, weekStart, moodNote: dto.moodNote ?? null, completedAt: now }),
      );
    }

    if (dto.entries.length > 0) {
      await this.entryRepo.save(
        dto.entries.map((e) => this.entryRepo.create({ weeklyCheckId: check!.id, categoryId: e.categoryId, level: e.level })),
      );
    }

    // 点検完了時に「今週のまとめ」を自動生成する（06 §4.2、ボタンを押させない）
    await this.reports.generateReport(userId, weekStart);

    // 柱の承認状態を再計算する（07 §3.2/§3.4）。点検データが変わる瞬間だけ状態が変わりうるので
    // ここで遅延評価する。昇格・降格ともに通知は送らない
    await this.pillars.recomputeVerification(userId, this.currentMondayJST());

    const gentleNudge = await this.buildGentleNudge(userId);

    const saved = await this.checkRepo.findOneOrFail({ where: { id: check.id }, relations: { entries: true } });
    return { check: saved, safetyVerdict, hotlines, gentleNudge };
  }

  /**
   * 育成提案は独立機能としては廃止した（06 §5.1）。唯一の例外として、確かな柱が0件のまま
   * 点検が4回続いた人にだけ、点検完了後に1回だけ静かに提示する（§5.2）。
   *
   * 承認は3週連続の点検で成立する（07 §3.2）ので、4回点検して0件なら「0件の状態が続いた」
   * とみなせる。出したことは `zero_pillar_nudge_sent_at` に刻んで二度と出さない。
   */
  private async buildGentleNudge(userId: string): Promise<string | null> {
    const profile = await this.profileRepo.findOne({ where: { id: userId } });
    if (!profile || profile.zeroPillarNudgeSentAt) return null;

    const checkCount = await this.checkRepo.count({ where: { userId } });
    if (checkCount < ZERO_PILLAR_NUDGE_CHECKS) return null;

    const pillars = await this.portfolio.getPillars(userId);
    if (pillars.verified.length > 0) return null;

    await this.profileRepo.update(userId, { zeroPillarNudgeSentAt: new Date() });
    return ZERO_PILLAR_NUDGE_MESSAGE;
  }

  /** JST基準で今週の月曜日を返す */
  private currentMondayJST(): string {
    const todayStr = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date());
    return this.mondayOf(todayStr);
  }

  private mondayOf(date: string): string {
    const d = new Date(`${date}T00:00:00Z`);
    const day = d.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setUTCDate(d.getUTCDate() + diff);
    return d.toISOString().split('T')[0];
  }

  private addDays(date: string, days: number): string {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().split('T')[0];
  }
}
