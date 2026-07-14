import { randomUUID } from 'crypto';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { SupabaseAuthGuard } from '../../src/auth/supabase-auth.guard';
import { FakeAuthGuard } from './fake-auth-guard';

export async function createTestApp(): Promise<{ app: INestApplication; dataSource: DataSource }> {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideGuard(SupabaseAuthGuard)
    .useClass(FakeAuthGuard)
    .compile();

  const app = moduleFixture.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();

  const dataSource = moduleFixture.get(DataSource);
  return { app, dataSource };
}

/** テスト用の使い捨てユーザーID/メールを生成する（Supabase Authには存在しない、DB上だけのテストユーザー） */
export function makeTestUser() {
  const id = randomUUID();
  return { id, email: `${id}@test.local` };
}

export function authHeaders(user: { id: string; email: string }) {
  return { 'x-test-user-id': user.id, 'x-test-user-email': user.email };
}

/** profilesを消せばON DELETE CASCADEで関連データ(categories/records/等)も全て消える */
export async function cleanupUsers(dataSource: DataSource, userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;
  await dataSource.query('DELETE FROM profiles WHERE id = ANY($1::uuid[])', [userIds]);
}
