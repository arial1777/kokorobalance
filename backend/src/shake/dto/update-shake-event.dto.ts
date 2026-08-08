import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class UpdateShakeEventDto {
  @IsOptional()
  @IsDateString()
  eventDate?: string;

  @IsOptional()
  @IsBoolean()
  isDateCertain?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  expectedShake?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID(undefined, { each: true })
  affectedCategoryIds?: string[];

  /** ペアにタイトルまで共有するか（09 §2.1）。いつでも取り消せる（E-09） */
  @IsOptional()
  @IsBoolean()
  shareTitleWithPair?: boolean;
}
