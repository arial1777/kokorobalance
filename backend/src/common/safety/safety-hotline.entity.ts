import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** 相談窓口。DB管理でデプロイなしの即時更新を可能にする（03 §5.1）。 */
@Entity('safety_hotlines')
export class SafetyHotline {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 20 })
  category: string;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 30 })
  phone: string;

  @Column({ name: 'hours_text', length: 50 })
  hoursText: string;

  @Column({ name: 'available_24h', default: false })
  available24h: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  url: string | null;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
