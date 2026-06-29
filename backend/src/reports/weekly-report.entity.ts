import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { Profile } from '../profile/profile.entity';

@Entity('weekly_reports')
@Unique(['userId', 'weekStartDate'])
export class WeeklyReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => Profile, (p) => p.weeklyReports, { onDelete: 'CASCADE' })
  user: Profile;

  @Column({ name: 'week_start_date', type: 'date' })
  weekStartDate: string;

  @Column({ name: 'category_breakdown', type: 'jsonb', default: '{}' })
  categoryBreakdown: Record<string, number>;

  @Column({ name: 'total_score', default: 0 })
  totalScore: number;

  @Column({ name: 'diversity_score', default: 0 })
  diversityScore: number;

  @Column({ name: 'ai_comment', type: 'text', nullable: true })
  aiComment: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
