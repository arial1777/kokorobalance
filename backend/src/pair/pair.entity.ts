import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Profile } from '../profile/profile.entity';
import type { PairState } from './pair.types';

/** 1対1の相互承認の関係（09-spec-pair.md）。コミュニティではない */
@Entity('pairs')
export class Pair {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** 招待した側 */
  @Column({ name: 'user_a_id' })
  userAId: string;

  @ManyToOne(() => Profile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_a_id' })
  userA: Profile;

  /** 受諾するまで null */
  @Column({ name: 'user_b_id', type: 'uuid', nullable: true })
  userBId: string | null;

  @Column({ name: 'invite_code', type: 'varchar', length: 8, nullable: true })
  inviteCode: string | null;

  @Column({ name: 'invite_expires_at', type: 'timestamptz', nullable: true })
  inviteExpiresAt: Date | null;

  @Column({ type: 'varchar', length: 10, default: 'invited' })
  state: PairState;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'activated_at', type: 'timestamptz', nullable: true })
  activatedAt: Date | null;

  @Column({ name: 'ended_at', type: 'timestamptz', nullable: true })
  endedAt: Date | null;
}
