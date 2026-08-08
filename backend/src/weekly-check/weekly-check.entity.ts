import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { Profile } from '../profile/profile.entity';
import { WeeklyCheckEntry } from './weekly-check-entry.entity';

/** 週次点検（06-spec-weekly-check.md）。日次記録に代わる主記録手段。 */
@Entity('weekly_checks')
@Unique(['userId', 'weekStart'])
export class WeeklyCheck {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => Profile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: Profile;

  @Column({ name: 'week_start', type: 'date' })
  weekStart: string;

  @Column({ name: 'mood_note', type: 'text', nullable: true })
  moodNote: string | null;

  @Column({ name: 'completed_at', type: 'timestamptz' })
  completedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => WeeklyCheckEntry, (e) => e.weeklyCheck, { cascade: true })
  entries: WeeklyCheckEntry[];
}
