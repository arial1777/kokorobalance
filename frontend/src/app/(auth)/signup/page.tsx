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
