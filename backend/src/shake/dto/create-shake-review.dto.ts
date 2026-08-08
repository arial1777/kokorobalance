import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import type { WasSupported } from '../shake.types';

export class CreateShakeReviewDto {
  @IsInt()
  @Min(1)
  @Max(3)
  feltShake: number;

  @IsIn(['yes', 'partly', 'no'])
  wasSupported: WasSupported;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID(undefined, { each: true })
  helpedCategoryIds?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
