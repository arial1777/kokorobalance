import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Pair } from './pair.entity';
import { Category } from '../categories/category.entity';
import type { VerificationRequestAnswer, VerificationRequestState } from './pair.types';

/** 「この柱を確かな柱として承認してほしい」の依頼（09-spec-pair.md §3） */
@Entity('pillar_verification_requests')
export class PillarVerificationRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'pair_id' })
  pairId: string;

  @ManyToOne(() => Pair, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pair_id' })
  pair: Pair;

  @Column({ name: 'category_id' })
  categoryId: string;

  @ManyToOne(() => Category, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'category_id' })
  category: Category;

  @Column({ name: 'requester_id' })
  requesterId: string;

  @Column({ type: 'varchar', length: 10, default: 'pending' })
  state: VerificationRequestState;

  /**
   * 回答の中身。**依頼者向けのレスポンスには決して載せない**（PR-A-05）。
   * 「よく知らない」が伝わることは、このプロダクトが絶対に避けるべきメッセージ。
   */
  @Column({ type: 'varchar', length: 10, nullable: true })
  answer: VerificationRequestAnswer | null;

  @Column({ name: 'responded_at', type: 'timestamptz', nullable: true })
  respondedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
