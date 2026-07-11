import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtStrategy } from './jwt.strategy';
import { ProPlanGuard } from './pro-plan.guard';
import { SupabaseAuthGuard } from './supabase-auth.guard';
import { DevAuthController } from './dev-auth.controller';
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
  controllers: [DevAuthController],
  providers: [JwtStrategy, ProPlanGuard, SupabaseAuthGuard],
  exports: [JwtStrategy, ProPlanGuard, SupabaseAuthGuard, TypeOrmModule],
})
export class AuthModule {}
