import { ArrayMaxSize, IsArray, IsDateString, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class WeeklyCheckEntryDto {
  @IsUUID()
  categoryId: string;

  @IsInt()
  @Min(1)
  @Max(3)
  level: number;
}

export class UpsertWeeklyCheckDto {
  @IsOptional()
  @IsDateString()
  weekStart?: string;

  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => WeeklyCheckEntryDto)
  entries: WeeklyCheckEntryDto[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  moodNote?: string;
}
