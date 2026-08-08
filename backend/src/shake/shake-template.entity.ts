import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { ShakeCategory } from './shake.types';

/** テンプレート（05-spec-shake-forecast.md §4.2）。DB管理でデプロイなしの調整を可能にする。 */
@Entity('shake_templates')
export class ShakeTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'template_key', length: 40, unique: true })
  templateKey: string;

  @Column({ type: 'varchar', length: 20 })
  category: ShakeCategory;

  @Column({ length: 50 })
  label: string;

  @Column({ name: 'default_expected_shake', default: 2 })
  defaultExpectedShake: number;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @Column({ default: true })
  active: boolean;
}
