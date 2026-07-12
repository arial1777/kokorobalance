'use client';

import { useMutation } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth';
import { api } from '@/lib/api';

const FREE_FEATURES = ['毎日の記録', '心のポートフォリオ', '偏りアラート', '週間レポート（基本）'];
const PRO_FEATURES = [...FREE_FEATURES, '週間レポート（AIコメント付き）', 'AIコーチ（チャット）', '心のリスク診断'];

export default function PricingPage() {
  const { profile } = useAuthStore();

  const checkoutMutation = useMutation({
    mutationFn: () => api.post<{ url: string }>('/payments/create-checkout'),
    onSuccess: ({ url }) => { window.location.href = url; },
  });

  return (
    <div className="min-h-screen px-4 py-12 max-w-lg mx-auto">
      <div className="text-center mb-10">
        <h1 className="text-2xl font-bold">料金プラン</h1>
        <p className="text-gray-500 text-sm mt-2">自分に合ったプランで心を管理</p>
      </div>

      <div className="grid gap-4">
        {/* Free */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-bold">Free</h2>
            <span className="text-2xl font-bold">¥0</span>
          </div>
          <p className="text-sm text-gray-500 mb-4">ずっと無料</p>
          <ul className="space-y-2">
            {FREE_FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm">
                <span className="text-green-500">✓</span>{f}
              </li>
            ))}
          </ul>
          {profile?.plan === 'free' && (
            <div className="mt-4 py-2 text-center text-sm text-gray-400 border border-gray-200 rounded-xl">
              現在のプラン
            </div>
          )}
        </div>

        {/* Pro */}
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-bold">Pro</h2>
            <div className="text-right">
              <span className="text-2xl font-bold">¥330</span>
              <span className="text-sm opacity-80">/月</span>
            </div>
          </div>
          <p className="text-sm opacity-80 mb-4">AIコーチ込みの全機能</p>
          <ul className="space-y-2">
            {PRO_FEATURES.map((f, i) => (
              <li key={f} className="flex items-center gap-2 text-sm">
                <span className={i >= FREE_FEATURES.length ? 'text-yellow-300' : 'text-green-300'}>✓</span>
                <span className={i >= FREE_FEATURES.length ? 'font-medium' : ''}>{f}</span>
              </li>
            ))}
          </ul>
          {profile?.plan === 'pro' ? (
            <div className="mt-4 py-2 text-center text-sm bg-white/20 rounded-xl">
              ご利用中
            </div>
          ) : (
            <button
              onClick={() => checkoutMutation.mutate()}
              disabled={checkoutMutation.isPending}
              className="mt-4 w-full py-2.5 bg-white text-indigo-600 font-bold rounded-xl hover:bg-gray-50 disabled:opacity-70 transition"
            >
              {checkoutMutation.isPending ? '処理中...' : 'Proにアップグレード'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
