import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventLog } from './event-log.entity';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(EventLog)
    private readonly repo: Repository<EventLog>,
  ) {}

  async track(
    userId: string | null,
    eventName: string,
    properties: Record<string, unknown> = {},
  ): Promise<void> {
    await this.repo.save(this.repo.create({ userId, eventName, properties }));
  }
}
