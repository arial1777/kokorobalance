import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { ChunkedSecureStoreAdapter } from './secure-store-adapter';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// createClient() throws synchronously (unguarded) if either value is missing, and this module is
// imported from the root layout, so a missing EAS build-time env var previously took down the app
// before any UI could render — surface which var is missing instead of a bare "supabaseUrl is
// required" from inside the library.
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    `Missing Supabase env var(s): ${[
      !supabaseUrl && 'EXPO_PUBLIC_SUPABASE_URL',
      !supabaseAnonKey && 'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    ]
      .filter(Boolean)
      .join(', ')}. Check EAS env vars for this build profile (eas env:list --environment production).`,
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ChunkedSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});
