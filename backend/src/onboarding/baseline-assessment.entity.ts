import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { Profile } from '../profile/profile.entity';
import { Category } from '../categories/category.entity';

@Entity('baseline_assessments')
@Unique(['userId', 'categoryId'])
export class BaselineAssessment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => Profile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: Profile;

  @Column({ name: 'category_id' })
  categoryId: string;

  @ManyToOne(() => Category, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'category_id' })
  category: Category;

  @Column({ type: 'smallint' })
  level: 1 | 2 | 3;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
