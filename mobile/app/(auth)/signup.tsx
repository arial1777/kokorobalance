import { useState } from 'react';
import { View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Link, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from '@/lib/supabase';
import { Icon } from '@/components/ui/icon';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';
const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://kokorobalance.example.com';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [agreed, setAgreed] = useState(false);

  async function handleSignup() {
    setLoading(true);
    setError('');

    if (__DEV__) {
      const res = await fetch(`${API_URL}/api/auth/dev-signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        setError(data.message ?? '登録に失敗しました');
        setLoading(false);
        return;
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError('登録しましたがログインに失敗しました。ログインページからお試しください。');
        setLoading(false);
        return;
      }
      router.replace('/onboarding');
      return;
    }

    const emailRedirectTo = makeRedirectUri({ scheme: 'kokorobalance', path: 'onboarding' });
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <View className="max-w-sm items-center">
          <View className="mb-5 h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Icon name="mail" filled color="#1A3352" size={30} />
          </View>
          <Text className="mb-2 text-xl font-bold text-foreground">確認メールを送信しました</Text>
          <Text className="text-center text-sm leading-relaxed text-muted-foreground">
            {email} に確認メールを送りました。メール内のリンクをタップして登録を完了してください。
          </Text>
        </View>
      </View>
    );
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
            <Text className="text-2xl font-bold text-foreground">ようこそ</Text>
            <Text className="mt-1.5 text-sm text-muted-foreground">心の柱を育てよう。無料で登録できます</Text>
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
              <Text className="mb-1.5 text-sm font-medium text-foreground">パスワード（8文字以上）</Text>
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

            <Pressable onPress={() => setAgreed((v) => !v)} className="flex-row items-start gap-2.5">
              <View
                className={`mt-0.5 h-4 w-4 items-center justify-center rounded border ${agreed ? 'border-primary bg-primary' : 'border-border'}`}
              >
                {agreed && <Icon name="check" size={12} color="#FFFFFF" />}
              </View>
              <Text className="flex-1 text-xs leading-relaxed text-muted-foreground">
                <Text
                  className="text-accent"
                  onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/terms`)}
                >
                  利用規約
                </Text>
                と
                <Text
                  className="text-accent"
                  onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/privacy`)}
                >
                  プライバシーポリシー
                </Text>
                に同意します（16歳以上の方がご利用いただけます）
              </Text>
            </Pressable>

            <Pressable
              onPress={handleSignup}
              disabled={loading || !agreed || !email || !password}
              className={`rounded-xl bg-primary py-3.5 ${loading || !agreed || !email || !password ? 'opacity-50' : ''}`}
            >
              <Text className="text-center text-sm font-semibold text-white">
                {loading ? '登録中...' : '無料ではじめる'}
              </Text>
            </Pressable>
          </View>

          <View className="mt-6 flex-row justify-center gap-1">
            <Text className="text-sm text-muted-foreground">すでにアカウントをお持ちの方は</Text>
            <Link href="/login" className="text-sm font-medium text-accent">
              ログイン
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
