import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventLog } from './event-log.entity';
import { Profile } from '../profile/profile.entity';
import { sanitizeEventProperties } from './event-properties';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(EventLog)
    private readonly repo: Repository<EventLog>,
    @InjectRepository(Profile)
    private readonly profileRepo: Repository<Profile>,
  ) {}

  /**
   * 分析イベントを記録する。
   *
   * - プロパティは許可リストで落とす。自由記述の本文と柱のラベルは保存しない（11 ME-01/ME-02）
   * - 分析をオプトアウトしたユーザーのイベントは保存しない（ME-05）。
   *   **セーフティの検知自体はオプトアウトの対象外**で、`safety_events` は別経路で記録される（03 §6.3、ME-03）
   * - 落としたことをログに出さない（本文がログに残っては本末転倒）
   */
  async track(
    userId: string | null,
    eventName: string,
    properties: Record<string, unknown> = {},
  ): Promise<void> {
    if (userId && (await this.hasOptedOut(userId))) return;
    await this.repo.save(
      this.repo.create({ userId, eventName, properties: sanitizeEventProperties(properties) }),
    );
  }

  private async hasOptedOut(userId: string): Promise<boolean> {
    const profile = await this.profileRepo.findOne({ where: { id: userId } });
    return profile?.analyticsOptOut ?? false;
  }
}
