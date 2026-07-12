'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Icon } from '@/components/ui/icon';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const IS_DEV = process.env.NODE_ENV !== 'production';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [agreed, setAgreed] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (IS_DEV) {
      const res = await fetch(`${API_URL}/api/auth/dev-signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { message?: string };
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
      router.push('/onboarding');
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${location.origin}/onboarding` },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    setSent(true);
  }

  async function handleGoogleSignup() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback?next=/dashboard` },
    });
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 bg-background">
        <div className="text-center max-w-sm">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-5">
            <Icon name="mail" filled className="text-3xl text-primary" />
          </div>
          <h2 className="text-xl font-bold mb-2">確認メールを送信しました</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {email} に確認メールを送りました。メール内のリンクをクリックして登録を完了してください。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-background">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-4 shadow-lg shadow-primary/10">
            <Icon name="donut_large" filled className="text-3xl text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">ようこそ</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">心の柱を育てよう。無料で登録できます</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              メールアドレス
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="w-full px-4 py-3 bg-white border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent placeholder:text-muted-foreground/50 transition"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              パスワード（8文字以上）
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              placeholder="••••••••"
              className="w-full px-4 py-3 bg-white border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent placeholder:text-muted-foreground/50 transition"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-4 py-3">
              <Icon name="error" filled className="text-lg flex-shrink-0" />
              {error}
            </div>
          )}

          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-primary"
            />
            <span className="text-xs text-muted-foreground leading-relaxed">
              <Link href="/terms" target="_blank" className="text-accent hover:underline">利用規約</Link>
              と
              <Link href="/privacy" target="_blank" className="text-accent hover:underline">プライバシーポリシー</Link>
              に同意します（16歳以上の方がご利用いただけます）
            </span>
          </label>

          <button
            type="submit"
            disabled={loading || !agreed}
            className="w-full py-3.5 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-50 transition shadow-sm shadow-primary/10 text-sm"
          >
            {loading ? '登録中...' : '無料ではじめる'}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">または</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <button
          onClick={handleGoogleSignup}
          disabled={!agreed}
          className="w-full py-3 border border-border bg-white text-foreground font-medium rounded-xl hover:bg-secondary disabled:opacity-50 transition flex items-center justify-center gap-2.5 text-sm"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Googleで登録
        </button>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          すでにアカウントをお持ちの方は{' '}
          <Link href="/login" className="text-accent font-medium hover:underline">
            ログイン
          </Link>
        </p>
      </div>
    </div>
  );
}
