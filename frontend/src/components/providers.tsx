'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { queryClient } from '@/lib/query-client';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';

export function Providers({ children }: { children: React.ReactNode }) {
  const { setUser } = useAuthStore();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, [setUser]);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
