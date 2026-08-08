import { IsIn, IsOptional } from 'class-validator';
import type { PlanInterval } from '../payments.service';

export class CreateCheckoutDto {
  /** 省略時は年額（年額主導線 → 10-pricing-b2b.md §2.1 ①） */
  @IsOptional()
  @IsIn(['month', 'annual'])
  interval?: PlanInterval;
}
