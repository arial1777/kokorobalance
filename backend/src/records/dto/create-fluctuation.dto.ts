import { IsDateString, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import type { FluctuationMagnitude } from '../fluctuation-event.entity';

export class CreateFluctuationDto {
  @IsDateString()
  occurredDate: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsIn(['small', 'medium', 'large'])
  magnitude: FluctuationMagnitude;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
