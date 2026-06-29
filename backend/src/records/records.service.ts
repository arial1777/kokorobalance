import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { DailyRecord } from './daily-record.entity';
import { DailyRecordItem } from './daily-record-item.entity';
import { CreateRecordDto } from './dto/create-record.dto';

@Injectable()
export class RecordsService {
  constructor(
    @InjectRepository(DailyRecord)
    private readonly recordRepo: Repository<DailyRecord>,
    @InjectRepository(DailyRecordItem)
    private readonly itemRepo: Repository<DailyRecordItem>,
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

  async upsert(userId: string, dto: CreateRecordDto): Promise<DailyRecord> {
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

    return this.recordRepo.findOneOrFail({
      where: { id: record.id },
      relations: { items: { category: true } },
    });
  }
}
