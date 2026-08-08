import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { WeeklyCheck } from './weekly-check.entity';
import { Category } from '../categories/category.entity';

/** level=0（未選択）は行を作らない。「支えにならなかった」を記録しない（原則1）。 */
@Entity('weekly_check_entries')
@Unique(['weeklyCheckId', 'categoryId'])
export class WeeklyCheckEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'weekly_check_id' })
  weeklyCheckId: string;

  @ManyToOne(() => WeeklyCheck, (w) => w.entries, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'weekly_check_id' })
  weeklyCheck: WeeklyCheck;

  @Column({ name: 'category_id' })
  categoryId: string;

  @ManyToOne(() => Category, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'category_id' })
  category: Category;

  @Column({ type: 'int' })
  level: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
