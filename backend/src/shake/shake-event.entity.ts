import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Profile } from '../profile/profile.entity';
import type { ShakeCategory, ShakeStatus, SupportListSnapshot } from './shake.types';

/** 揺れそうな日（05-spec-shake-forecast.md）。 */
@Entity('shake_events')
export class ShakeEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => Profile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: Profile;

  @Column({ length: 60 })
  title: string;

  @Column({ name: 'template_key', type: 'varchar', length: 40, nullable: true })
  templateKey: string | null;

  @Column({ type: 'varchar', length: 20 })
  category: ShakeCategory;

  @Column({ name: 'event_date', type: 'date' })
  eventDate: string;

  @Column({ name: 'is_date_certain', default: true })
  isDateCertain: boolean;

  @Column({ name: 'expected_shake', default: 2 })
  expectedShake: number;

  @Column({ name: 'duration_days', type: 'int', nullable: true })
  durationDays: number | null;

  @Column({ name: 'affected_category_ids', type: 'uuid', array: true, default: () => "'{}'" })
  affectedCategoryIds: string[];

  @Column({ type: 'varchar', length: 10, default: 'planned' })
  status: ShakeStatus;

  @Column({ name: 'support_list_snapshot', type: 'jsonb', nullable: true })
  supportListSnapshot: SupportListSnapshot | null;

  @Column({ name: 'support_list_notified_at', type: 'timestamptz', nullable: true })
  supportListNotifiedAt: Date | null;

  @Column({ name: 'today_notified_at', type: 'timestamptz', nullable: true })
  todayNotifiedAt: Date | null;

  @Column({ name: 'review_notified_at', type: 'timestamptz', nullable: true })
  reviewNotifiedAt: Date | null;

  /** 揺れの前の整理（08-spec-companion.md §6、Pro限定、D-3に1回だけ生成） */
  @Column({ name: 'pre_reflection', type: 'text', nullable: true })
  preReflection: string | null;

  @Column({ name: 'pre_reflection_generated_at', type: 'timestamptz', nullable: true })
  preReflectionGeneratedAt: Date | null;

  /** ペアにタイトルまで共有するか。既定は共有しない（09 §2.1、E-09でいつでも取り消せる） */
  @Column({ name: 'share_title_with_pair', default: false })
  shareTitleWithPair: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
