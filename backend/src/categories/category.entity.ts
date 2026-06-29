import { Column, CreateDateColumn, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Profile } from '../profile/profile.entity';
import { DailyRecordItem } from '../records/daily-record-item.entity';

@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => Profile, (p) => p.categories, { onDelete: 'CASCADE' })
  user: Profile;

  @Column({ length: 50 })
  name: string;

  @Column({ name: 'parent_name', length: 50 })
  parentName: string;

  @Column({ name: 'is_preset', default: true })
  isPreset: boolean;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ length: 7, default: '#6B7280' })
  color: string;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => DailyRecordItem, (i) => i.category)
  recordItems: DailyRecordItem[];
}
