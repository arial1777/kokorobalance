import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Profile } from '../profile/profile.entity';

@Entity('ai_coach_messages')
export class AiCoachMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => Profile, (p) => p.aiCoachMessages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: Profile;

  @Column({ length: 10 })
  role: 'user' | 'assistant';

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'is_crisis', default: false })
  isCrisis: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
