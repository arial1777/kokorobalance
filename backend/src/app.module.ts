import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { ProfileModule } from './profile/profile.module';
import { CategoriesModule } from './categories/categories.module';
import { RecordsModule } from './records/records.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { ReportsModule } from './reports/reports.module';
import { CoachModule } from './coach/coach.module';
import { PaymentsModule } from './payments/payments.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: false,
        ssl:
          config.get('NODE_ENV') === 'production'
            ? { rejectUnauthorized: false }
            : false,
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    ProfileModule,
    CategoriesModule,
    RecordsModule,
    PortfolioModule,
    ReportsModule,
    CoachModule,
    PaymentsModule,
  ],
})
export class AppModule {}
