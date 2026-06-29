import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DailyRecord } from './daily-record.entity';
import { DailyRecordItem } from './daily-record-item.entity';
import { RecordsService } from './records.service';
import { RecordsController } from './records.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DailyRecord, DailyRecordItem])],
  providers: [RecordsService],
  controllers: [RecordsController],
  exports: [RecordsService, TypeOrmModule],
})
export class RecordsModule {}
