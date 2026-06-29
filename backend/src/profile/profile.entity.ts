import { Column, CreateDateColumn, Entity, OneToMany, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { Category } from '../categories/category.entity';
import { DailyRecord } from '../records/daily-record.entity';
import { WeeklyReport } from '../reports/weekly-report.entity';
import { AiCoachMessage } from '../coach/ai-coach-message.entity';
import { Subscription } from '../payments/subscription.entity';

@Entity('profiles')
export class Profile {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ length: 50, default: '名無し' })
  nickname: string;

  @Column({ length: 20, default: 'free' })
  plan: 'free' | 'pro';

  @Column({ name: 'onboarding_completed', default: false })
  onboardingCompleted: boolean;

  @Column({ name: 'reminder_time', type: 'time', nullable: true })
  reminderTime: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => Category, (c) => c.user)
  categories: Category[];

  @OneToMany(() => DailyRecord, (r) => r.user)
  dailyRecords: DailyRecord[];

  @OneToMany(() => WeeklyReport, (r) => r.user)
  weeklyReports: WeeklyReport[];

  @OneToMany(() => AiCoachMessage, (m) => m.user)
  aiCoachMessages: AiCoachMessage[];

  @OneToMany(() => Subscription, (s) => s.user)
  subscriptions: Subscription[];
}
