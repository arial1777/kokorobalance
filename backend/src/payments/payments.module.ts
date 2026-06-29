import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Subscription } from './subscription.entity';
import { Profile } from '../profile/profile.entity';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Subscription, Profile])],
  providers: [PaymentsService],
  controllers: [PaymentsController],
})
export class PaymentsModule {}
