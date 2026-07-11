import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '@/types';

interface AuthState {
  user: User | null;
  profile: Profile | null;
  /** 初回のSupabaseセッション確認が完了したか */
  initializing: boolean;
  setUser: (user: User | null) => void;
  setProfile: (profile: Profile | null) => void;
  setInitializing: (initializing: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  initializing: true,
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setInitializing: (initializing) => set({ initializing }),
}));
