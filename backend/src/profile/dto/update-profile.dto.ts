import { IsBoolean, IsOptional, IsString, Length, Matches } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Length(1, 50)
  nickname?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'HH:MM 形式で入力してください' })
  reminderTime?: string;

  @IsOptional()
  @IsBoolean()
  emailReminderEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  safetyReviewOptOut?: boolean;

  /** 柱の再定義（07）の移行通知を閉じたか */
  @IsOptional()
  @IsBoolean()
  pillarNoticeDismissed?: boolean;

  /** 分析イベントの記録を止める（11 ME-05） */
  @IsOptional()
  @IsBoolean()
  analyticsOptOut?: boolean;
}
