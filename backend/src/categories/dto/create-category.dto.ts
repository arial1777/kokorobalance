import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsHexColor,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { PillarKind, VerificationAnswer } from '../pillar.types';

/** 柱のラベルの最大長（07-spec-pillars.md P-10） */
export const PILLAR_LABEL_MAX = 20;

const KINDS: PillarKind[] = ['place', 'relation', 'habit'];

export class CreateCategoryDto {
  @IsString()
  @Length(1, PILLAR_LABEL_MAX)
  name: string;

  @IsString()
  @Length(1, 50)
  parentName: string;

  @IsOptional()
  @IsHexColor()
  color?: string;

  @IsOptional()
  @IsIn(KINDS)
  kind?: PillarKind;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  importance?: number;

  @IsOptional()
  @IsBoolean()
  isFragile?: boolean;
}

export class BulkActivateCategoriesDto {
  @IsArray()
  @IsUUID('4', { each: true })
  presetIds: string[];
}

/** オンボーディングで複数の柱をまとめて登録する（07 §4.1） */
export class BulkCreateCategoriesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => CreateCategoryDto)
  pillars: CreateCategoryDto[];
}

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @Length(1, PILLAR_LABEL_MAX)
  name?: string;

  @IsOptional()
  @IsHexColor()
  color?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsIn(KINDS)
  kind?: PillarKind;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  importance?: number;

  @IsOptional()
  @IsBoolean()
  isFragile?: boolean;
}

export class DeclareVerificationDto {
  @IsIn(['yes', 'unsure', 'not_yet'])
  answer: VerificationAnswer;
}
