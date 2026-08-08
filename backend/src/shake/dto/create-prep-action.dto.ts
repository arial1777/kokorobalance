import { IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreatePrepActionDto {
  @IsString()
  @Length(1, 60)
  body: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;
}
