import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsInt, IsOptional, IsString, IsUUID, Max, Min, ValidateNested } from 'class-validator';

export class RecordItemDto {
  @IsUUID()
  categoryId: string;

  @IsInt()
  @Min(-100)
  @Max(100)
  score: number;

  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateRecordDto {
  @IsDateString()
  recordedDate: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecordItemDto)
  items: RecordItemDto[];
}
