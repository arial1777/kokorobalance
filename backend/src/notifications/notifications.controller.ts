import { Controller, Get, Header, Param, ParseUUIDPipe } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  /** メール内のワンクリック配信停止リンク（認証不要） */
  @Get('unsubscribe/:token')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async unsubscribe(@Param('token', ParseUUIDPipe) token: string): Promise<string> {
    await this.service.unsubscribe(token);
    return `<!DOCTYPE html>
<html lang="ja"><head><meta charset="utf-8"><title>配信停止 | ココロバランス</title></head>
<body style="font-family: sans-serif; text-align: center; padding: 64px 24px;">
  <h1 style="color: #1A3352;">配信を停止しました</h1>
  <p>リマインドメールの配信を停止しました。<br/>再開はアプリの設定画面からいつでもできます。</p>
</body></html>`;
  }
}
