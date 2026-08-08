import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ShakeEvent } from './shake-event.entity';
import { Category } from '../categories/category.entity';
import type { PrepSource, PrepState } from './shake.types';

/** 備え（05-spec-shake-forecast.md §5）。 */
@Entity('prep_actions')
export class PrepAction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'shake_event_id' })
  shakeEventId: string;

  @ManyToOne(() => ShakeEvent, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shake_event_id' })
  shakeEvent: ShakeEvent;

  @Column({ name: 'category_id', nullable: true })
  categoryId: string | null;

  @ManyToOne(() => Category, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'category_id' })
  category: Category | null;

  @Column({ length: 60 })
  body: string;

  @Column({ type: 'varchar', length: 10 })
  source: PrepSource;

  @Column({ name: 'due_date', type: 'date' })
  dueDate: string;

  @Column({ type: 'varchar', length: 10, default: 'suggested' })
  state: PrepState;

  @Column({ name: 'state_changed_at', type: 'timestamptz' })
  stateChangedAt: Date;

  @Column({ name: 'promised_detail', type: 'varchar', length: 60, nullable: true })
  promisedDetail: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
