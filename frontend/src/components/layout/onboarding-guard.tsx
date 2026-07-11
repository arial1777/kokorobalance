'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Profile } from '@/types';

export function OnboardingGuard() {
  const router = useRouter();

  const { data: profile } = useQuery<Profile>({
    queryKey: ['profile'],
    queryFn: () => api.get<Profile>('/profile'),
  });

  useEffect(() => {
    if (profile && !profile.onboardingCompleted) {
      router.replace('/onboarding');
    }
  }, [profile, router]);

  return null;
}
