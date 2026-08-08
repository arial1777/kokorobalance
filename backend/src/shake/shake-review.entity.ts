import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ShakeEvent } from './shake-event.entity';
import type { WasSupported } from './shake.types';

/** ふりかえり（05-spec-shake-forecast.md §7）。 */
@Entity('shake_reviews')
export class ShakeReview {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'shake_event_id', unique: true })
  shakeEventId: string;

  @ManyToOne(() => ShakeEvent, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shake_event_id' })
  shakeEvent: ShakeEvent;

  @Column({ name: 'felt_shake' })
  feltShake: number;

  @Column({ name: 'was_supported', type: 'varchar', length: 10 })
  wasSupported: WasSupported;

  @Column({ name: 'helped_category_ids', type: 'uuid', array: true, default: () => "'{}'" })
  helpedCategoryIds: string[];

  @Column({ type: 'text', nullable: true })
  note: string | null;

  /** ふりかえりの言語化（08-spec-companion.md §6、Pro限定） */
  @Column({ name: 'ai_reflection', type: 'text', nullable: true })
  aiReflection: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
