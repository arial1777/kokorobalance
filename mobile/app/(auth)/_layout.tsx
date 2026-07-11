import { Redirect, Stack } from 'expo-router';
import { useAuthStore } from '@/store/auth';

export default function AuthLayout() {
  const { user, initializing } = useAuthStore();

  if (!initializing && user) return <Redirect href="/dashboard" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
