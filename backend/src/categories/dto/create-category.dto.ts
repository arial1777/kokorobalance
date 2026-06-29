import { IsArray, IsBoolean, IsHexColor, IsInt, IsOptional, IsString, IsUUID, Length, Min } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @Length(1, 50)
  name: string;

  @IsString()
  @Length(1, 50)
  parentName: string;

  @IsOptional()
  @IsHexColor()
  color?: string;
}

export class BulkActivateCategoriesDto {
  @IsArray()
  @IsUUID('4', { each: true })
  presetIds: string[];
}

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @Length(1, 50)
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
}
