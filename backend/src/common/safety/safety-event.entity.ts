import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Profile } from '../../profile/profile.entity';
import type { SafetyActionTaken, SafetyCategory, SafetySource, SafetyVerdict } from './safety.types';

/**
 * 検知の監査ログ（03 §6.3）。本文は保存しない（raw_excerpt_hash のみ）。
 * verdict='clear' は記録しない。偽陰性の抽出レビューは ai_coach_messages 本体からサンプリングする。
 */
@Entity('safety_events')
export class SafetyEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => Profile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: Profile;

  @Column({ type: 'varchar', length: 20 })
  source: SafetySource;

  @Column({ type: 'varchar', length: 10 })
  verdict: SafetyVerdict;

  @Column({ type: 'varchar', length: 20, nullable: true })
  category: SafetyCategory | null;

  @Column({ name: 'matched_rules', type: 'text', array: true, default: () => "'{}'" })
  matchedRules: string[];

  @Column({ name: 'action_taken', type: 'varchar', length: 30 })
  actionTaken: SafetyActionTaken;

  @Column({ name: 'raw_excerpt_hash', length: 64 })
  rawExcerptHash: string;

  @Column({ name: 'reviewed_by_human', default: false })
  reviewedByHuman: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
