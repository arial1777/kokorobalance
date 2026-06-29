'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { PresetCategory } from '@/types';

const STEPS = ['ようこそ', 'カテゴリ選択', '最初の記録'] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: presets = [] } = useQuery<PresetCategory[]>({
    queryKey: ['presets'],
    queryFn: () => api.get<PresetCategory[]>('/categories/presets'),
    enabled: step === 1,
  });

  const bulkMutation = useMutation({
    mutationFn: (presetIds: string[]) =>
      api.post('/categories/bulk', { presetIds }),
  });

  const onboardingMutation = useMutation({
    mutationFn: () => api.patch('/profile/onboarding'),
    onSuccess: () => router.push('/dashboard'),
  });

  const grouped = presets.reduce<Record<string, PresetCategory[]>>((acc, p) => {
    (acc[p.parentName] ??= []).push(p);
    return acc;
  }, {});

  async function handleNext() {
    if (step === 1) {
      await bulkMutation.mutateAsync(Array.from(selected));
    }
    if (step === STEPS.length - 1) {
      await onboardingMutation.mutateAsync();
      return;
    }
    setStep((s) => s + 1);
  }

  return (
    <div className="min-h-screen max-w-lg mx-auto px-4 py-8">
      {/* ステップ表示 */}
      <div className="flex gap-2 mb-8">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-indigo-500' : 'bg-gray-200'}`}
          />
        ))}
      </div>

      {/* Step 0: ようこそ */}
      {step === 0 && (
        <div className="text-center">
          <div className="text-6xl mb-4">🧘</div>
          <h1 className="text-2xl font-bold mb-3">ようこそ、ココロバランスへ</h1>
          <p className="text-gray-500 text-sm leading-relaxed mb-2">
            人は一つのことに依存しすぎると、それが崩れたとき心も崩れます。
          </p>
          <p className="text-gray-500 text-sm leading-relaxed mb-6">
            このアプリでは「心を満たすもの」を記録し、<strong>依存の偏り</strong>を可視化します。毎日1分で心のバランスを保ちましょう。
          </p>
          <div className="grid grid-cols-3 gap-3 mb-8 text-center">
            {[['📊', '記録する', '毎日1分'], ['🥧', '可視化', '円グラフで確認'], ['⚠️', '偏りアラート', '依存に気づく']].map(([emoji, title, sub]) => (
              <div key={title} className="bg-indigo-50 rounded-xl p-3">
                <div className="text-2xl">{emoji}</div>
                <p className="text-xs font-bold mt-1">{title}</p>
                <p className="text-xs text-gray-400">{sub}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 1: カテゴリ選択 */}
      {step === 1 && (
        <div>
          <h2 className="text-xl font-bold mb-2">心を満たすものを選ぼう</h2>
          <p className="text-sm text-gray-500 mb-5">3つ以上選ぶのがおすすめです（{selected.size}個選択中）</p>
          <div className="space-y-4">
            {Object.entries(grouped).map(([group, cats]) => (
              <div key={group}>
                <p className="text-xs font-semibold text-gray-400 mb-2">{group}</p>
                <div className="flex flex-wrap gap-2">
                  {cats.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => {
                        setSelected((prev) => {
                          const next = new Set(prev);
                          next.has(cat.id) ? next.delete(cat.id) : next.add(cat.id);
                          return next;
                        });
                      }}
                      className={`px-3 py-1.5 rounded-full text-sm border-2 transition ${
                        selected.has(cat.id)
                          ? 'border-transparent text-white'
                          : 'border-gray-200 text-gray-600 bg-white'
                      }`}
                      style={selected.has(cat.id) ? { backgroundColor: cat.color, borderColor: cat.color } : {}}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: 完了 */}
      {step === 2 && (
        <div className="text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-xl font-bold mb-3">準備完了！</h2>
          <p className="text-sm text-gray-500 mb-6">
            {selected.size}個のカテゴリを設定しました。毎日記録してポートフォリオを育てましょう。
          </p>
        </div>
      )}

      <button
        onClick={handleNext}
        disabled={(step === 1 && selected.size < 1) || bulkMutation.isPending || onboardingMutation.isPending}
        className="mt-8 w-full py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition"
      >
        {step === STEPS.length - 1 ? 'はじめる' : '次へ'}
      </button>
    </div>
  );
}
