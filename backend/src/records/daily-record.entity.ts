import { Column, CreateDateColumn, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';
import { Profile } from '../profile/profile.entity';
import { DailyRecordItem } from './daily-record-item.entity';

@Entity('daily_records')
@Unique(['userId', 'recordedDate'])
export class DailyRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => Profile, (p) => p.dailyRecords, { onDelete: 'CASCADE' })
  user: Profile;

  @Column({ name: 'recorded_date', type: 'date' })
  recordedDate: string;

  @Column({ name: 'total_score', default: 0 })
  totalScore: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => DailyRecordItem, (i) => i.record, { cascade: true })
  items: DailyRecordItem[];
}
