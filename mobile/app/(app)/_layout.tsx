import { View, ActivityIndicator } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Icon } from '@/components/ui/icon';
import type { Profile } from '@/types';

export default function AppLayout() {
  const { user, initializing } = useAuthStore();

  const { data: profile, isLoading } = useQuery<Profile>({
    queryKey: ['profile'],
    queryFn: () => api.get<Profile>('/profile'),
    enabled: !!user,
  });

  if (!initializing && !user) return <Redirect href="/login" />;

  if (initializing || (user && isLoading)) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#1A3352" />
      </View>
    );
  }

  if (profile && !profile.onboardingCompleted) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#18130A',
        tabBarInactiveTintColor: '#6B5848',
        tabBarStyle: { height: 72, paddingTop: 8, paddingBottom: 12 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'ホーム',
          tabBarIcon: ({ color, focused }) => <Icon name="home" color={color as string} filled={focused} size={24} />,
        }}
      />
      <Tabs.Screen
        name="record"
        options={{
          title: '記録',
          tabBarIcon: ({ color, focused }) => <Icon name="edit" color={color as string} filled={focused} size={24} />,
        }}
      />
      <Tabs.Screen
        name="portfolio"
        options={{
          title: 'ポートフォリオ',
          tabBarIcon: ({ color, focused }) => <Icon name="donut_large" color={color as string} filled={focused} size={24} />,
        }}
      />
      <Tabs.Screen
        name="report"
        options={{
          title: 'レポート',
          tabBarIcon: ({ color, focused }) => <Icon name="description" color={color as string} filled={focused} size={24} />,
        }}
      />
      <Tabs.Screen name="coach" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
    </Tabs>
  );
}
