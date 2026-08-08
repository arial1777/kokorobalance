'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth';
import { api } from '@/lib/api';
import { ProLimitations } from '@/components/pro-limitations';
import type { PlanInterval, PlansResult } from '@/types';

// Free / Pro の境界は 10-pricing-b2b.md §2.3 に合わせる。主機能（揺れ予報・柱）は Free で全開放し、
// Pro は「深さ」を売る
const FREE_FEATURES = ['週次点検', '柱（居場所・相手・習慣）', '揺れ予報', '週間レポート（基本）', '壁打ち（1日1往復）'];
const PRO_EXTRAS = ['壁打ち（いつでも）', '週間レポートのひとこと', '揺れの前の整理', 'ふりかえりの言語化'];

/**
 * 380日継続率は年額19.9% vs 月額14.2%（E-13）なので、年額を上に置き既定にする（M-A-01）。
 * 案A（10 §2.2）: 月額¥330据え置き＋年額¥2,980追加。
 */
const PLAN_PRICES: Record<PlanInterval, { label: string; price: string; note: string }> = {
  annual: { label: '年額', price: '¥2,980', note: '実質248円/月・25%おトク' },
  month: { label: '月額', price: '¥330', note: 'いつでも解約できます' },
};

export function PricingClient() {
  const { profile } = useAuthStore();

  const { data: plans } = useQuery<PlansResult>({
    queryKey: ['payment-plans'],
    queryFn: () => api.get<PlansResult>('/payments/plans'),
  });

  const [interval, setInterval] = useState<PlanInterval | null>(null);
  const selected = interval ?? plans?.defaultInterval ?? 'month';
  const available = plans?.intervals ?? ['month'];

  const checkoutMutation = useMutation({
    mutationFn: () => api.post<{ url: string }>('/payments/create-checkout', { interval: selected }),
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
  });

  return (
    <div className="min-h-screen px-4 py-12 max-w-lg mx-auto">
      <div className="text-center mb-10">
        <h1 className="text-2xl font-bold">料金プラン</h1>
        <p className="text-gray-500 text-sm mt-2">揺れそうな日の備えは、無料で全部使えます</p>
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
                <span className="text-green-500">✓</span>
                {f}
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
          <h2 className="text-lg font-bold mb-1">Pro</h2>
          <p className="text-sm opacity-80 mb-4">つらくなりそうな日に、もう一歩ふみこむ</p>

          {/* 年額を上・既定にする（M-A-01） */}
          {profile?.plan !== 'pro' && (
            <div className="space-y-2 mb-4">
              {available.map((i) => {
                const p = PLAN_PRICES[i];
                const isSelected = selected === i;
                return (
                  <button
                    key={i}
                    onClick={() => setInterval(i)}
                    className={`w-full flex items-center justify-between rounded-xl px-4 py-3 border-2 transition ${
                      isSelected ? 'border-white bg-white/20' : 'border-white/30'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className={`w-4 h-4 rounded-full border-2 border-white flex-shrink-0 ${isSelected ? 'bg-white' : ''}`}
                      />
                      <span className="text-left">
                        <span className="block text-sm font-semibold">{p.label}</span>
                        <span className="block text-[11px] opacity-80">{p.note}</span>
                      </span>
                    </span>
                    <span className="text-lg font-bold">{p.price}</span>
                  </button>
                );
              })}
            </div>
          )}

          <ul className="space-y-2">
            {FREE_FEATURES.slice(0, -1).map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm">
                <span className="text-green-300">✓</span>
                {f}
              </li>
            ))}
            {PRO_EXTRAS.map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm">
                <span className="text-yellow-300">✓</span>
                <span className="font-medium">{f}</span>
              </li>
            ))}
          </ul>

          {profile?.plan === 'pro' ? (
            <div className="mt-4 py-2 text-center text-sm bg-white/20 rounded-xl">ご利用中</div>
          ) : (
            <button
              onClick={() => checkoutMutation.mutate()}
              disabled={checkoutMutation.isPending}
              className="mt-4 w-full py-2.5 bg-white text-indigo-600 font-bold rounded-xl hover:bg-gray-50 disabled:opacity-70 transition"
            >
              {checkoutMutation.isPending ? '処理中...' : `${PLAN_PRICES[selected].label}で始める`}
            </button>
          )}
        </div>

        {/* 課金前に制限を先に書く（M-A-02） */}
        <ProLimitations />

        <p className="text-xs text-gray-400 text-center leading-relaxed">
          解約はいつでもできます。解約の手順は設定 &gt; アカウントに書いてあります。
        </p>
      </div>
    </div>
  );
}
