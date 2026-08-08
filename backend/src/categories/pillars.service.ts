import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Category } from './category.entity';
import { VerificationAnswer } from './pillar.types';
import { AnalyticsService } from '../analytics/analytics.service';

/** 承認に必要な連続点検回数（07-spec-pillars.md §3.2 recurring_check） */
const CONSECUTIVE_WEEKS_TO_VERIFY = 3;
/** 点検に一度も出てこないと育て中に戻るまでの週数（§3.4） */
const WEEKS_UNTIL_DEMOTION = 8;
/** 「まだかな」と答えられた柱に再度問いを出さない期間（§3.3） */
const WEEKS_BEFORE_REASKING = 4;

@Injectable()
export class PillarsService {
  constructor(
    @InjectRepository(Category) private readonly categoryRepo: Repository<Category>,
    @InjectDataSource() private readonly ds: DataSource,
    private readonly analytics: AnalyticsService,
  ) {}

  /**
   * 承認状態を再計算する（07-spec-pillars.md §3.2 / §3.4）。
   *
   * 点検データが変わる瞬間にだけ状態が変わりうるので、週次点検の保存時に遅延評価する
   * （専用の cron ジョブは持たない）。8週以上離脱したユーザーも、復帰して点検した
   * 時点で正しく再計算される。
   *
   * **昇格・降格ともに通知を送らない。** 特に降格の通知は最も残酷な通知になる（§3.4、原則1）。
   */
  async recomputeVerification(userId: string, currentWeekStart: string): Promise<void> {
    const consecutiveWeeks = Array.from({ length: CONSECUTIVE_WEEKS_TO_VERIFY }, (_, i) =>
      this.addDays(currentWeekStart, -7 * i),
    );

    // 昇格: 直近3週すべての点検で選ばれている place / relation
    const promoted = await this.ds.query<{ kind: string }[]>(
      `UPDATE categories c
          SET verified_at = now(), verification_source = 'recurring_check'
        WHERE c.user_id = $1
          AND c.kind IN ('place', 'relation')
          AND c.verified_at IS NULL
          AND c.is_active = true
          AND (
            SELECT COUNT(DISTINCT wc.week_start)
              FROM weekly_checks wc
              JOIN weekly_check_entries wce ON wce.weekly_check_id = wc.id
             WHERE wc.user_id = $1
               AND wce.category_id = c.id
               AND wc.week_start = ANY($2::date[])
          ) = $3
        RETURNING c.kind`,
      [userId, consecutiveWeeks, CONSECUTIVE_WEEKS_TO_VERIFY],
    );
    // 11 §5「承認経路の内訳」。ラベルは送らない（ME-02）
    for (const row of promoted) {
      await this.analytics.track(userId, 'pillar_verified', {
        source: 'recurring_check',
        kind: row.kind,
      });
    }

    // 降格: 8週間まったく点検に出てこない柱を静かに育て中へ戻す。
    // 承認自体が8週の窓より新しいものは対象外（直前に self_declared された柱を即座に降ろさない）
    const demotionBoundary = this.addDays(currentWeekStart, -7 * WEEKS_UNTIL_DEMOTION);
    await this.ds.query(
      `UPDATE categories c
          SET verified_at = NULL, verification_source = NULL
        WHERE c.user_id = $1
          AND c.verified_at IS NOT NULL
          AND c.verified_at < $2::date
          AND NOT EXISTS (
            SELECT 1
              FROM weekly_checks wc
              JOIN weekly_check_entries wce ON wce.weekly_check_id = wc.id
             WHERE wc.user_id = $1
               AND wce.category_id = c.id
               AND wc.week_start >= $2::date
          )`,
      [userId, demotionBoundary],
    );
  }

  /**
   * 「そこにいる人たちも、あなたがそこにいると思っていそうですか？」への回答を反映する（§3.3）。
   * 「まだかな」を選んだことをネガティブに扱わず、次は4週後まで聞かない。
   */
  async declareVerification(userId: string, id: string, answer: VerificationAnswer): Promise<Category> {
    const category = await this.categoryRepo.findOne({ where: { id, userId } });
    if (!category) throw new NotFoundException('柱が見つかりません');
    if (category.kind === 'habit') {
      throw new BadRequestException('習慣は承認の対象ではありません');
    }

    const now = new Date();
    category.verificationAskedAt = now;
    if (answer === 'yes' && !category.verifiedAt) {
      category.verifiedAt = now;
      category.verificationSource = 'self_declared';
      await this.analytics.track(userId, 'pillar_verified', {
        source: 'self_declared',
        kind: category.kind,
      });
    }
    return this.categoryRepo.save(category);
  }

  /**
   * ペア解消後に、pair 由来の承認を 07 §3.4 の規則で処理する（09 PR-07）。
   * 一旦承認を落としてから再計算するので、recurring_check の条件を満たしていれば自動的に
   * 復帰し、満たさなければ育て中に戻る。**降格は通知しない**（09 E-05）。
   */
  async reevaluateAfterPairEnded(userId: string, currentWeekStart: string): Promise<void> {
    await this.ds.query(
      `UPDATE categories SET verified_at = NULL, verification_source = NULL
        WHERE user_id = $1 AND verification_source = 'pair'`,
      [userId],
    );
    await this.recomputeVerification(userId, currentWeekStart);
  }

  /** 承認の問いを出してよいか（未承認の place/relation で、4週以内に聞いていない） */
  shouldAskVerification(category: Category): boolean {
    if (category.kind === 'habit' || category.verifiedAt) return false;
    if (!category.verificationAskedAt) return true;
    const boundary = new Date(Date.now() - WEEKS_BEFORE_REASKING * 7 * 24 * 60 * 60 * 1000);
    return category.verificationAskedAt < boundary;
  }

  private addDays(date: string, days: number): string {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().split('T')[0];
  }
}
