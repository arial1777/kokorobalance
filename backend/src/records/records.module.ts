import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DailyRecord } from './daily-record.entity';
import { DailyRecordItem } from './daily-record-item.entity';
import { FluctuationEvent } from './fluctuation-event.entity';
import { RecordsService } from './records.service';
import { RecordsController } from './records.controller';
import { Category } from '../categories/category.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DailyRecord, DailyRecordItem, FluctuationEvent, Category])],
  providers: [RecordsService],
  controllers: [RecordsController],
  exports: [RecordsService, TypeOrmModule],
})
export class RecordsModule {}
