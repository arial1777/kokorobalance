import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Profile } from '../profile/profile.entity';

@Entity('ai_usage')
export class AiUsage {
  @PrimaryColumn({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => Profile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: Profile;

  @PrimaryColumn({ length: 7 })
  month: string;

  @Column({ name: 'chat_count', default: 0 })
  chatCount: number;
}
