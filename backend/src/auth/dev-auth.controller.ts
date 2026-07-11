import { Body, Controller, ForbiddenException, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Controller('auth')
export class DevAuthController {
  constructor(private readonly config: ConfigService) {}

  @Post('dev-signup')
  async devSignup(@Body() body: { email: string; password: string }) {
    if (this.config.get('NODE_ENV') === 'production') {
      throw new ForbiddenException('Not available in production');
    }

    const supabaseUrl = this.config.get<string>('SUPABASE_URL');
    const serviceRoleKey = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    const res = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey!,
      },
      body: JSON.stringify({
        email: body.email,
        password: body.password,
        email_confirm: true,
      }),
    });

    const data = await res.json() as Record<string, unknown>;
    if (!res.ok) {
      throw new ForbiddenException((data.message ?? data.msg ?? 'Signup failed') as string);
    }

    return { success: true, email: body.email };
  }
}
