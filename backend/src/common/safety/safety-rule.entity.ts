import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { SafetyCategory, SafetyVerdict } from './safety.types';

/** 第1段の決定的ルール辞書。DB管理でデプロイなしの即時更新を可能にする（03 §3.2）。 */
@Entity('safety_rules')
export class SafetyRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'rule_id', length: 20, unique: true })
  ruleId: string;

  @Column({ type: 'varchar', length: 20 })
  category: SafetyCategory;

  @Column({ type: 'varchar', length: 10 })
  verdict: SafetyVerdict;

  @Column({ type: 'text' })
  pattern: string;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
