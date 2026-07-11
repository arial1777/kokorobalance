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

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ name: 'unsubscribe_token', type: 'uuid', generated: 'uuid' })
  unsubscribeToken: string;

  @Column({ length: 20, default: 'free' })
  plan: 'free' | 'pro';

  @Column({ name: 'onboarding_completed', default: false })
  onboardingCompleted: boolean;

  @Column({ name: 'reminder_time', type: 'time', nullable: true })
  reminderTime: string | null;

  @Column({ name: 'suggestion_muted', default: false })
  suggestionMuted: boolean;

  @Column({ name: 'ai_consent_at', type: 'timestamptz', nullable: true })
  aiConsentAt: Date | null;

  @Column({ name: 'email_reminder_enabled', default: true })
  emailReminderEnabled: boolean;

  @Column({ name: 'expo_push_token', type: 'varchar', length: 255, nullable: true })
  expoPushToken: string | null;

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
