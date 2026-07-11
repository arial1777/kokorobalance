import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedException();

    const token = authHeader.slice(7);
    const supabaseUrl = this.config.get<string>('SUPABASE_URL')!;
    const supabaseKey = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY')!;

    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: supabaseKey,
      },
    });

    if (!res.ok) throw new UnauthorizedException();

    const user = await res.json() as { id: string; email?: string };
    if (!user?.id) throw new UnauthorizedException();

    request.user = { id: user.id, email: user.email };
    return true;
  }
}
