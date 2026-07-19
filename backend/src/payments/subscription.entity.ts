import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Profile } from '../profile/profile.entity';

@Entity('subscriptions')
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => Profile, (p) => p.subscriptions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: Profile;

  @Column({ length: 20, default: 'stripe' })
  provider: 'stripe' | 'revenuecat';

  @Column({ type: 'varchar', name: 'stripe_customer_id', length: 100, nullable: true })
  stripeCustomerId: string | null;

  @Column({ type: 'varchar', name: 'stripe_subscription_id', length: 100, unique: true, nullable: true })
  stripeSubscriptionId: string | null;

  @Column({ type: 'varchar', name: 'revenuecat_original_transaction_id', length: 100, unique: true, nullable: true })
  revenuecatOriginalTransactionId: string | null;

  @Column({ type: 'varchar', name: 'revenuecat_product_id', length: 100, nullable: true })
  revenuecatProductId: string | null;

  @Column({ length: 30 })
  status: 'active' | 'canceled' | 'past_due' | 'trialing';

  @Column({ length: 20, default: 'pro' })
  plan: string;

  @Column({ name: 'current_period_start', type: 'timestamptz', nullable: true })
  currentPeriodStart: Date | null;

  @Column({ name: 'current_period_end', type: 'timestamptz', nullable: true })
  currentPeriodEnd: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
