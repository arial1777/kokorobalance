import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { DailyRecord } from './daily-record.entity';
import { Category } from '../categories/category.entity';

@Entity('daily_record_items')
export class DailyRecordItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'record_id' })
  recordId: string;

  @ManyToOne(() => DailyRecord, (r) => r.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'record_id' })
  record: DailyRecord;

  @Column({ name: 'category_id' })
  categoryId: string;

  @ManyToOne(() => Category, (c) => c.recordItems, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'category_id' })
  category: Category;

  @Column({ type: 'int' })
  score: number;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
