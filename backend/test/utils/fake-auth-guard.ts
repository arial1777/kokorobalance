import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

/**
 * e2eテスト用にSupabaseAuthGuardを置き換えるフェイクガード。
 * 実際のSupabaseへのネットワーク呼び出しを避け、`x-test-user-id`/`x-test-user-email`
 * ヘッダーからreq.userを組み立てる。認可ロジック自体（ProPlanGuard・所有権チェック等）は
 * 本物のDB/サービスに対してそのまま実行されるため、e2eとしての検証価値は保たれる。
 */
@Injectable()
export class FakeAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const userId = request.headers['x-test-user-id'];
    if (!userId) throw new UnauthorizedException();
    request.user = {
      id: userId,
      email: request.headers['x-test-user-email'] ?? `${userId}@test.local`,
    };
    return true;
  }
}
