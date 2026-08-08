import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Profile } from '../profile/profile.entity';
import { DailyRecordItem } from '../records/daily-record-item.entity';
import type { PillarKind, VerificationSource } from './pillar.types';

/**
 * 柱（07-spec-pillars.md）。内部識別子は Category のまま、UI表記は「柱」。
 * kind により place（居場所）/ relation（相手）/ habit（習慣）に分かれ、
 * habit は承認（verified_at）の対象外で「確かな柱」の本数に数えない。
 */
@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => Profile, (p) => p.categories, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: Profile;

  @Column({ length: 50 })
  name: string;

  @Column({ name: 'parent_name', length: 50 })
  parentName: string;

  @Column({ name: 'is_preset', default: true })
  isPreset: boolean;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ length: 7, default: '#6B7280' })
  color: string;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @Column({ type: 'varchar', length: 10, default: 'habit' })
  kind: PillarKind;

  /** 承認された時刻。null = 育て中。habit は常に null（DB制約で担保） */
  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true })
  verifiedAt: Date | null;

  @Column({ name: 'verification_source', type: 'varchar', length: 20, nullable: true })
  verificationSource: VerificationSource | null;

  /** self_declared の問いを最後に出した時刻（§3.3: 4週間は再度聞かない） */
  @Column({ name: 'verification_asked_at', type: 'timestamptz', nullable: true })
  verificationAskedAt: Date | null;

  /** ユーザー主観の重要度。「主観的に重要な帰属」であることが効果の前提（E-04） */
  @Column({ type: 'int', default: 2 })
  importance: number;

  /** 「これが揺れたらしんどい」フラグ */
  @Column({ name: 'is_fragile', default: false })
  isFragile: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => DailyRecordItem, (i) => i.category)
  recordItems: DailyRecordItem[];
}
