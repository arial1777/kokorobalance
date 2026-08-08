import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';
import type { ShakeCategory } from '../shake.types';

const CATEGORIES: ShakeCategory[] = ['oshi', 'work', 'relationship', 'exam', 'health', 'money', 'life', 'other'];

export class CreateShakeEventDto {
  @IsOptional()
  @IsString()
  templateKey?: string;

  /** テンプレ未使用時（自由記述）は必須。テンプレ使用時は省略可（テンプレのlabelを使う） */
  @IsOptional()
  @IsString()
  @Length(1, 60)
  title?: string;

  /** テンプレ未使用時（自由記述）は必須。テンプレ使用時は省略可（テンプレのcategoryを使う） */
  @IsOptional()
  @IsIn(CATEGORIES)
  category?: ShakeCategory;

  @IsDateString()
  eventDate: string;

  @IsOptional()
  @IsBoolean()
  isDateCertain?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  expectedShake?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  durationDays?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID(undefined, { each: true })
  affectedCategoryIds?: string[];
}
