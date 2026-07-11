import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { DailyRecord } from './daily-record.entity';
import { DailyRecordItem } from './daily-record-item.entity';
import { FluctuationEvent } from './fluctuation-event.entity';
import { CreateRecordDto } from './dto/create-record.dto';
import { CreateFluctuationDto } from './dto/create-fluctuation.dto';

export interface RecordFeedback {
  todaysPillars: number;
  highlights: { categoryName: string; weeklyCount: number }[];
}

export interface SaveRecordResult {
  record: DailyRecord;
  feedback: RecordFeedback;
}

@Injectable()
export class RecordsService {
  constructor(
    @InjectRepository(DailyRecord)
    private readonly recordRepo: Repository<DailyRecord>,
    @InjectRepository(DailyRecordItem)
    private readonly itemRepo: Repository<DailyRecordItem>,
    @InjectRepository(FluctuationEvent)
    private readonly fluctuationRepo: Repository<FluctuationEvent>,
  ) {}

  async getRecords(userId: string, from: string, to: string): Promise<DailyRecord[]> {
    return this.recordRepo.find({
      where: { userId, recordedDate: Between(from as any, to as any) },
      relations: { items: { category: true } },
      order: { recordedDate: 'DESC' },
    });
  }

  async getRecordByDate(userId: string, date: string): Promise<DailyRecord | null> {
    return this.recordRepo.findOne({
      where: { userId, recordedDate: date as any },
      relations: { items: { category: true } },
    });
  }

  async upsert(userId: string, dto: CreateRecordDto): Promise<SaveRecordResult> {
    let record = await this.recordRepo.findOne({
      where: { userId, recordedDate: dto.recordedDate as any },
    });

    if (record) {
      await this.itemRepo.delete({ recordId: record.id });
    } else {
      record = this.recordRepo.create({ userId, recordedDate: dto.recordedDate });
      record = await this.recordRepo.save(record);
    }

    const items = dto.items.map((item) =>
      this.itemRepo.create({
        recordId: record!.id,
        categoryId: item.categoryId,
        score: item.score,
        note: item.note ?? null,
      }),
    );
    await this.itemRepo.save(items);

    const totalScore = dto.items.reduce((sum, i) => sum + i.score, 0);
    await this.recordRepo.update(record.id, { totalScore });

    const saved = await this.recordRepo.findOneOrFail({
      where: { id: record.id },
      relations: { items: { category: true } },
    });

    const feedback = await this.buildFeedback(userId, dto.recordedDate, saved);
    return { record: saved, feedback };
  }

  /** 保存直後の即時フィードバック用データ（今日の柱の本数と今週の記録回数） */
  private async buildFeedback(
    userId: string,
    date: string,
    record: DailyRecord,
  ): Promise<RecordFeedback> {
    const categoryIds = record.items.map((i) => i.categoryId);
    if (categoryIds.length === 0) return { todaysPillars: 0, highlights: [] };

    const from = this.addDays(date, -6);
    const rows = await this.itemRepo
      .createQueryBuilder('ri')
      .innerJoin('ri.record', 'r')
      .innerJoin('ri.category', 'c')
      .select('c.name', 'categoryName')
      .addSelect('COUNT(DISTINCT r.recorded_date)', 'weeklyCount')
      .where('r.user_id = :userId', { userId })
      .andWhere('r.recorded_date BETWEEN :from AND :to', { from, to: date })
      .andWhere('ri.category_id IN (:...categoryIds)', { categoryIds })
      .groupBy('c.name')
      .orderBy('COUNT(DISTINCT r.recorded_date)', 'DESC')
      .getRawMany<{ categoryName: string; weeklyCount: string }>();

    return {
      todaysPillars: categoryIds.length,
      highlights: rows.slice(0, 2).map((r) => ({
        categoryName: r.categoryName,
        weeklyCount: Number(r.weeklyCount),
      })),
    };
  }

  getFluctuations(userId: string, from: string, to: string): Promise<FluctuationEvent[]> {
    return this.fluctuationRepo.find({
      where: { userId, occurredDate: Between(from as any, to as any) },
      relations: { category: true },
      order: { occurredDate: 'DESC', createdAt: 'DESC' },
    });
  }

  async createFluctuation(userId: string, dto: CreateFluctuationDto): Promise<FluctuationEvent> {
    const event = this.fluctuationRepo.create({
      userId,
      categoryId: dto.categoryId ?? null,
      occurredDate: dto.occurredDate,
      magnitude: dto.magnitude,
      note: dto.note ?? null,
    });
    const saved = await this.fluctuationRepo.save(event);
    return this.fluctuationRepo.findOneOrFail({
      where: { id: saved.id },
      relations: { category: true },
    });
  }

  async deleteFluctuation(userId: string, id: string): Promise<void> {
    const result = await this.fluctuationRepo.delete({ id, userId });
    if (!result.affected) {
      throw new NotFoundException('揺らぎイベントが見つかりません');
    }
  }

  private addDays(date: string, days: number): string {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().split('T')[0];
  }
}
