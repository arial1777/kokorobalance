import { useState } from 'react';
import { View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Link, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import Svg, { Path } from 'react-native-svg';
import { supabase } from '@/lib/supabase';
import { Icon } from '@/components/ui/icon';

function GoogleLogo() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24">
      <Path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <Path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <Path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <Path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </Svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError('メールアドレスまたはパスワードが正しくありません');
      setLoading(false);
      return;
    }
    router.replace('/dashboard');
  }

  async function handleGoogleLogin() {
    const redirectTo = makeRedirectUri({ scheme: 'kokorobalance', path: 'dashboard' });
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error || !data.url) return;
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type === 'success' && result.url) {
      await supabase.auth.exchangeCodeForSession(result.url);
      router.replace('/dashboard');
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-background"
    >
      <ScrollView contentContainerClassName="flex-1 items-center justify-center px-6">
        <View className="w-full max-w-sm">
          <View className="mb-10 items-center">
            <View className="mb-4 h-14 w-14 items-center justify-center rounded-2xl bg-primary">
              <Icon name="donut_large" filled color="#FFFFFF" size={28} />
            </View>
            <Text className="text-2xl font-bold text-foreground">おかえりなさい</Text>
            <Text className="mt-1.5 text-sm text-muted-foreground">ログインして心の記録を続けよう</Text>
          </View>

          <View className="gap-4">
            <View>
              <Text className="mb-1.5 text-sm font-medium text-foreground">メールアドレス</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="you@example.com"
                className="rounded-xl border border-border bg-white px-4 py-3 text-sm text-foreground"
                placeholderTextColor="#6B584880"
              />
            </View>
            <View>
              <Text className="mb-1.5 text-sm font-medium text-foreground">パスワード</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="••••••••"
                className="rounded-xl border border-border bg-white px-4 py-3 text-sm text-foreground"
                placeholderTextColor="#6B584880"
              />
            </View>

            {error ? (
              <View className="flex-row items-center gap-2 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3">
                <Icon name="error" size={18} color="#DC2626" filled />
                <Text className="text-sm text-rose-600">{error}</Text>
              </View>
            ) : null}

            <Pressable
              onPress={handleLogin}
              disabled={loading || !email || !password}
              className={`rounded-xl bg-primary py-3.5 ${loading || !email || !password ? 'opacity-50' : ''}`}
            >
              <Text className="text-center text-sm font-semibold text-white">
                {loading ? 'ログイン中...' : 'ログイン'}
              </Text>
            </Pressable>
          </View>

          <View className="my-5 flex-row items-center gap-3">
            <View className="h-px flex-1 bg-border" />
            <Text className="text-xs text-muted-foreground">または</Text>
            <View className="h-px flex-1 bg-border" />
          </View>

          <Pressable
            onPress={handleGoogleLogin}
            className="flex-row items-center justify-center gap-2.5 rounded-xl border border-border bg-white py-3"
          >
            <GoogleLogo />
            <Text className="text-sm font-medium text-foreground">Googleでログイン</Text>
          </Pressable>

          <View className="mt-8 flex-row justify-center gap-1">
            <Text className="text-sm text-muted-foreground">アカウントをお持ちでない方は</Text>
            <Link href="/signup" className="text-sm font-medium text-accent">
              新規登録
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
