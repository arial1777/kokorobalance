import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsIn, IsInt, IsUUID, ValidateNested } from 'class-validator';

export class BaselineItemDto {
  @IsUUID()
  categoryId: string;

  @IsInt()
  @IsIn([1, 2, 3])
  level: number;
}

export class SaveBaselineDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => BaselineItemDto)
  items: BaselineItemDto[];
}
