'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Profile } from '@/types';

/**
 * オンボーディング未完了のユーザーを/onboardingへ誘導する。
 * 判定が終わるまでchildren（ダッシュボード等）を描画しないことで、
 * 未登録・未オンボーディングのユーザーに一瞬でもホーム画面が
 * 見えてしまう（Googleログイン直後など）のを防ぐ。
 */
export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const { data: profile, isPending } = useQuery<Profile>({
    queryKey: ['profile'],
    queryFn: () => api.get<Profile>('/profile'),
  });

  const needsOnboarding = !isPending && !!profile && !profile.onboardingCompleted;

  useEffect(() => {
    if (needsOnboarding) {
      router.replace('/onboarding');
    }
  }, [needsOnboarding, router]);

  if (isPending || needsOnboarding) {
    return (
      <div className="flex items-center justify-center h-screen text-sm text-muted-foreground">
        読み込み中...
      </div>
    );
  }

  return <>{children}</>;
}
