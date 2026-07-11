import { IsObject, IsOptional, IsString, Length, Matches } from 'class-validator';

export class TrackEventDto {
  @IsString()
  @Length(1, 100)
  @Matches(/^[a-z0-9_]+$/, { message: 'イベント名は英小文字・数字・アンダースコアのみ' })
  eventName: string;

  @IsOptional()
  @IsObject()
  properties?: Record<string, unknown>;
}
