import { IsString, Length } from 'class-validator';

export class ChatDto {
  @IsString()
  @Length(1, 500)
  message: string;
}
