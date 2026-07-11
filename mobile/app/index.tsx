import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuthStore } from '@/store/auth';

export default function Index() {
  const { user, initializing } = useAuthStore();

  if (initializing) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#1A3352" />
      </View>
    );
  }

  if (!user) return <Redirect href="/login" />;
  return <Redirect href="/dashboard" />;
}
