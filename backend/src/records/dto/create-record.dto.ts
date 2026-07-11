import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';

export class RecordItemDto {
  @IsUUID()
  categoryId: string;

  @IsInt()
  @IsIn([1, 2, 3])
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
