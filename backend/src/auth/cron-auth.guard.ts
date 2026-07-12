import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Cloud Schedulerからのcronトリガーを共有シークレットで検証する */
@Injectable()
export class CronAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers['authorization'];
    const secret = this.config.get<string>('CRON_SECRET');

    if (!secret || authHeader !== `Bearer ${secret}`) {
      throw new UnauthorizedException();
    }
    return true;
  }
}
