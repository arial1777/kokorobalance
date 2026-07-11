import { IsString, Matches } from 'class-validator';

export class RegisterPushTokenDto {
  @IsString()
  @Matches(/^ExponentPushToken\[.+\]$/, { message: '不正なプッシュトークン形式です' })
  token: string;
}
