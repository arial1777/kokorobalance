'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { track } from '@/lib/analytics';
import { clearLpDiagnosis, loadLpDiagnosis } from '@/lib/lp-diagnosis';
import { Icon } from '@/components/ui/icon';
import { PortfolioPie } from '@/components/charts/portfolio-pie';
import type { Category, Portfolio, PresetCategory, Profile } from '@/types';

const STEPS = ['カテゴリ', 'ふりかえり', '完成'] as const;

type Level = 1 | 2 | 3;

const BASELINE_LEVELS: { value: Level; label: string }[] = [
  { value: 1, label: 'すこし' },
  { value: 2, label: 'まあまあ' },
  { value: 3, label: 'たっぷり' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const qc = useQueryClient();
  // step 0: ようこそ / 1: カテゴリ / 2: ふりかえり診断 / 3: ポートフォリオ完成
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [myCategories, setMyCategories] = useState<Category[]>([]);
  const [baselineLevels, setBaselineLevels] = useState<Record<string, Level>>({});

  const { data: presets = [] } = useQuery<PresetCategory[]>({
    queryKey: ['presets'],
    queryFn: () => api.get<PresetCategory[]>('/categories/presets'),
    enabled: step === 1,
  });

  // LPミニ診断からのプリフィル: 選択済みが空のときだけ種付けする
  useEffect(() => {
    if (presets.length === 0) return;
    setSelected((prev) => {
      if (prev.size > 0) return prev;
      const lp = loadLpDiagnosis();
      if (!lp || lp.length === 0) return prev;
      const names = new Set(lp.map((i) => i.presetName));
      const ids = presets.filter((p) => names.has(p.name)).map((p) => p.id);
      return ids.length > 0 ? new Set(ids) : prev;
    });
  }, [presets]);

  const bulkMutation = useMutation({
    mutationFn: (presetIds: string[]) =>
      api.post<Category[]>('/categories/bulk', { presetIds }),
    onSuccess: (categories) => {
      setMyCategories(categories);
      // LPミニ診断の度合いをふりかえり診断の初期値に引き継ぐ
      const lp = loadLpDiagnosis();
      if (lp && lp.length > 0) {
        const levelByName = new Map(lp.map((i) => [i.presetName, i.level]));
        const init: Record<string, Level> = {};
        categories.forEach((c) => {
          const level = levelByName.get(c.name);
          if (level) init[c.id] = level;
        });
        if (Object.keys(init).length > 0) setBaselineLevels(init);
        clearLpDiagnosis();
      }
      setStep(2);
    },
  });

  const baselineMutation = useMutation({
    mutationFn: () =>
      api.post('/onboarding/baseline', {
        items: Object.entries(baselineLevels).map(([categoryId, level]) => ({
          categoryId,
          level,
        })),
      }),
    onSuccess: () => setStep(3),
  });

  // 診断完了後に初期ポートフォリオを取得（Ahaモーメント①）
  const { data: portfolio } = useQuery<Portfolio>({
    queryKey: ['portfolio', 'onboarding'],
    queryFn: () => api.get<Portfolio>('/portfolio?period=30'),
    enabled: step === 3,
  });

  // KPI: Ahaモーメント①到達（v2 §10.1）
  useEffect(() => {
    if (step === 3 && portfolio) track('baseline_portfolio_viewed');
  }, [step, portfolio]);

  const onboardingMutation = useMutation({
    mutationFn: () => api.patch<Profile>('/profile/onboarding'),
    onSuccess: (profile) => {
      track('onboarding_completed');
      qc.setQueryData(['profile'], profile);
      router.push('/dashboard');
    },
  });

  const grouped = presets.reduce<Record<string, PresetCategory[]>>((acc, p) => {
    (acc[p.parentName] ??= []).push(p);
    return acc;
  }, {});

  const allAnswered =
    myCategories.length > 0 &&
    myCategories.every((c) => baselineLevels[c.id] !== undefined);

  // ---------- Step 0: ようこそ ----------
  if (step === 0) {
    return (
      <div className="min-h-screen bg-[#1A3352] flex flex-col">
        <div className="flex-1 max-w-lg mx-auto px-6 pt-16 pb-8 flex flex-col">
          <div className="flex-1">
            <div className="mb-10">
              <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center mb-6">
                <Icon name="donut_large" filled className="text-4xl text-white" />
              </div>
              <h1 className="text-3xl font-bold text-white mb-3 leading-tight">
                ようこそ、
                <br />
                ココロバランスへ
              </h1>
              <p className="text-white/60 text-sm leading-relaxed">
                心の支えは、1本より3本。
                <br />
                あなたの心を支える柱を育てよう。
              </p>
            </div>

            <div className="space-y-3">
              {[
                { icon: 'donut_large', title: '心のポートフォリオ', desc: 'あなたの心が何で満たされているかを可視化' },
                { icon: 'psychiatry', title: '心の柱を育てる', desc: '支えを増やして、揺れにくい心をつくる' },
                { icon: 'smart_toy', title: 'AIコーチ', desc: 'データをもとに具体的な行動を提案' },
              ].map(({ icon, title, desc }) => (
                <div key={title} className="flex items-start gap-4 bg-white/10 rounded-2xl p-4">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                    <Icon name={icon} filled className="text-2xl text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-white">{title}</p>
                    <p className="text-xs text-white/60 mt-0.5 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => setStep(1)}
            className="mt-10 w-full py-4 bg-[#E05A3A] text-white font-semibold rounded-xl hover:bg-[#c94d30] transition shadow-lg text-sm"
          >
            はじめる
          </button>
          <p className="mt-4 text-center text-[11px] text-white/40 leading-relaxed">
            本アプリは医療・診断を目的としたものではありません
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto px-4 pt-8 pb-10">
        {/* プログレスバー */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((label, i) => {
            const stepIndex = i + 1; // step 1〜3 に対応
            return (
              <div key={i} className="flex items-center gap-2 flex-1">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition ${
                    stepIndex <= step ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground'
                  }`}
                >
                  {stepIndex < step ? <Icon name="check" className="text-sm text-white" /> : i + 1}
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 rounded-full transition ${
                      stepIndex < step ? 'bg-primary' : 'bg-secondary'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Step 1: カテゴリ選択 */}
        {step === 1 && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-bold text-foreground mb-1">心を満たすものを選ぼう</h2>
              <p className="text-sm text-muted-foreground">
                3〜8個がおすすめ
                {selected.size > 0 && (
                  <span className="ml-2 text-accent font-semibold">{selected.size}個選択中</span>
                )}
              </p>
            </div>
            <div className="space-y-5">
              {Object.entries(grouped).map(([group, cats]) => (
                <div key={group}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">
                    {group}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {cats.map((cat) => {
                      const isSelected = selected.has(cat.id);
                      return (
                        <button
                          key={cat.id}
                          onClick={() => {
                            setSelected((prev) => {
                              const next = new Set(prev);
                              next.has(cat.id) ? next.delete(cat.id) : next.add(cat.id);
                              return next;
                            });
                          }}
                          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium border-2 transition ${
                            isSelected
                              ? 'text-white border-transparent shadow-sm'
                              : 'border-border bg-white text-foreground hover:border-primary/30'
                          }`}
                          style={isSelected ? { backgroundColor: cat.color, borderColor: cat.color } : {}}
                        >
                          {isSelected && <Icon name="check" className="text-sm text-white" />}
                          {cat.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => bulkMutation.mutate(Array.from(selected))}
              disabled={selected.size < 1 || bulkMutation.isPending}
              className="mt-8 w-full py-3.5 bg-accent text-white font-semibold rounded-xl hover:bg-[#c94d30] disabled:opacity-50 transition shadow-lg shadow-accent/20 text-sm"
            >
              {bulkMutation.isPending ? '保存中…' : '次へ'}
            </button>
          </div>
        )}

        {/* Step 2: ふりかえり診断 */}
        {step === 2 && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-bold text-foreground mb-1">この1ヶ月をふりかえろう</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                それぞれ、どれくらいあなたの心を満たしてくれましたか？
              </p>
            </div>

            <div className="space-y-3">
              {myCategories.map((cat) => {
                const level = baselineLevels[cat.id];
                return (
                  <div key={cat.id} className="bg-white rounded-2xl border border-border shadow-sm p-4">
                    <div className="flex items-center gap-2.5 mb-3">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="font-medium text-sm text-foreground">{cat.name}</span>
                    </div>
                    <div className="flex gap-2">
                      {BASELINE_LEVELS.map(({ value, label }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() =>
                            setBaselineLevels((prev) => ({ ...prev, [cat.id]: value }))
                          }
                          className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition ${
                            level === value
                              ? 'bg-primary text-white border-primary'
                              : 'bg-secondary text-muted-foreground border-transparent hover:border-primary/30'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => baselineMutation.mutate()}
              disabled={!allAnswered || baselineMutation.isPending}
              className="mt-8 w-full py-3.5 bg-accent text-white font-semibold rounded-xl hover:bg-[#c94d30] disabled:opacity-50 transition shadow-lg shadow-accent/20 text-sm"
            >
              {baselineMutation.isPending
                ? '診断中…'
                : allAnswered
                  ? 'ポートフォリオを見る'
                  : 'すべて答えてください'}
            </button>
          </div>
        )}

        {/* Step 3: 初期ポートフォリオ（Ahaモーメント①） */}
        {step === 3 && (
          <div>
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-foreground mb-2">
                これがいまの、
                <br />
                あなたの心のバランスです
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                毎日の記録で、すこしずつ実際のデータに置き換わっていきます
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-border shadow-sm p-5">
              {portfolio ? (
                <PortfolioPie breakdown={portfolio.breakdown} />
              ) : (
                <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
                  読み込み中…
                </div>
              )}
            </div>

            {portfolio && portfolio.breakdown[0] && (
              <p className="text-center text-sm text-muted-foreground mt-4 leading-relaxed">
                いまのあなたは「
                <span className="font-semibold text-foreground">
                  {portfolio.breakdown[0].categoryName}
                </span>
                」が {portfolio.breakdown[0].percentage}% を支えています
              </p>
            )}

            <button
              onClick={() => onboardingMutation.mutate()}
              disabled={onboardingMutation.isPending}
              className="mt-8 w-full py-3.5 bg-accent text-white font-semibold rounded-xl hover:bg-[#c94d30] disabled:opacity-50 transition shadow-lg shadow-accent/20 text-sm"
            >
              {onboardingMutation.isPending ? 'はじめています…' : 'ダッシュボードへ'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
