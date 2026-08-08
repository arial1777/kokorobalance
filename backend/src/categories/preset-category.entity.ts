import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { PillarKind } from './pillar.types';

@Entity('preset_categories')
export class PresetCategory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 50 })
  name: string;

  @Column({ name: 'parent_name', length: 50 })
  parentName: string;

  @Column({ length: 7 })
  color: string;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @Column({ type: 'varchar', length: 10, default: 'habit' })
  kind: PillarKind;
}
