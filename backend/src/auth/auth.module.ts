import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtStrategy } from './jwt.strategy';
import { ProPlanGuard } from './pro-plan.guard';
import { Profile } from '../profile/profile.entity';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('SUPABASE_JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([Profile]),
  ],
  providers: [JwtStrategy, ProPlanGuard],
  exports: [JwtStrategy, ProPlanGuard, TypeOrmModule],
})
export class AuthModule {}
