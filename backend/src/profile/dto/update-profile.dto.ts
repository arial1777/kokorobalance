import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Length(1, 50)
  nickname?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'HH:MM 形式で入力してください' })
  reminderTime?: string;
}
