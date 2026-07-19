import '../global.css';
import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/query-client';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { Toaster } from '@/components/ui/toaster';
import { configurePurchases, loginPurchases, logoutPurchases } from '@/lib/purchases';
import '@/lib/push-notifications';

function NotificationTapHandler() {
  const router = useRouter();

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const url = response.notification.request.content.data?.url;
      if (typeof url === 'string') router.push(url as never);
    });
    return () => subscription.remove();
  }, [router]);

  return null;
}

function AuthBootstrap() {
  const setUser = useAuthStore((s) => s.setUser);
  const setInitializing = useAuthStore((s) => s.setInitializing);

  useEffect(() => {
    configurePurchases();

    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setInitializing(false);
      if (data.session?.user) loginPurchases(data.session.user.id).catch(() => {});
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loginPurchases(session.user.id).catch(() => {});
      } else if (event === 'SIGNED_OUT') {
        logoutPurchases();
      }
    });

    return () => subscription.subscription.unsubscribe();
  }, [setUser, setInitializing]);

  return null;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthBootstrap />
          <NotificationTapHandler />
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }} />
          <Toaster />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
