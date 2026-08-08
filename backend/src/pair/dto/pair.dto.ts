import { IsIn, IsString, IsUUID, Length } from 'class-validator';
import type { VerificationRequestAnswer } from '../pair.types';

export class AcceptInviteDto {
  @IsString()
  @Length(6, 8)
  code: string;
}

export class RequestVerificationDto {
  @IsUUID()
  categoryId: string;
}

export class RespondToRequestDto {
  @IsIn(['known', 'unsure'])
  answer: VerificationRequestAnswer;
}
