import { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { track } from '@/lib/analytics';
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
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [myCategories, setMyCategories] = useState<Category[]>([]);
  const [baselineLevels, setBaselineLevels] = useState<Record<string, Level>>({});

  const { data: presets = [] } = useQuery<PresetCategory[]>({
    queryKey: ['presets'],
    queryFn: () => api.get<PresetCategory[]>('/categories/presets'),
    enabled: step === 1,
  });

  const bulkMutation = useMutation({
    mutationFn: (presetIds: string[]) => api.post<Category[]>('/categories/bulk', { presetIds }),
    onSuccess: (categories) => {
      setMyCategories(categories);
      setStep(2);
    },
  });

  const baselineMutation = useMutation({
    mutationFn: () =>
      api.post('/onboarding/baseline', {
        items: Object.entries(baselineLevels).map(([categoryId, level]) => ({ categoryId, level })),
      }),
    onSuccess: () => setStep(3),
  });

  const { data: portfolio } = useQuery<Portfolio>({
    queryKey: ['portfolio', 'onboarding'],
    queryFn: () => api.get<Portfolio>('/portfolio?period=30'),
    enabled: step === 3,
  });

  const onboardingMutation = useMutation({
    mutationFn: () => api.patch<Profile>('/profile/onboarding'),
    onSuccess: (profile) => {
      track('onboarding_completed');
      qc.setQueryData(['profile'], profile);
      router.replace('/dashboard');
    },
  });

  const grouped = presets.reduce<Record<string, PresetCategory[]>>((acc, p) => {
    (acc[p.parentName] ??= []).push(p);
    return acc;
  }, {});

  const allAnswered =
    myCategories.length > 0 && myCategories.every((c) => baselineLevels[c.id] !== undefined);

  if (step === 0) {
    return (
      <View className="flex-1 bg-[#1A3352]">
        <ScrollView contentContainerClassName="flex-grow px-6 pb-8 pt-16" className="max-w-lg self-center">
          <View className="mb-10">
            <View className="mb-6 h-16 w-16 items-center justify-center rounded-2xl bg-white/15">
              <Icon name="donut_large" filled color="#FFFFFF" size={32} />
            </View>
            <Text className="mb-3 text-3xl font-bold leading-tight text-white">
              ようこそ、{'\n'}ココロバランスへ
            </Text>
            <Text className="text-sm leading-relaxed text-white/60">
              心の支えは、1本より3本。{'\n'}あなたの心を支える柱を育てよう。
            </Text>
          </View>

          <View className="gap-3">
            {[
              { icon: 'donut_large', title: '心のポートフォリオ', desc: 'あなたの心が何で満たされているかを可視化' },
              { icon: 'psychiatry', title: '心の柱を育てる', desc: '支えを増やして、揺れにくい心をつくる' },
              { icon: 'smart_toy', title: 'AIコーチ', desc: 'データをもとに具体的な行動を提案' },
            ].map(({ icon, title, desc }) => (
              <View key={title} className="flex-row items-start gap-4 rounded-2xl bg-white/10 p-4">
                <View className="h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                  <Icon name={icon} filled color="#FFFFFF" size={22} />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-white">{title}</Text>
                  <Text className="mt-0.5 text-xs leading-relaxed text-white/60">{desc}</Text>
                </View>
              </View>
            ))}
          </View>

          <Pressable
            onPress={() => setStep(1)}
            className="mt-10 rounded-xl bg-[#E05A3A] py-4 shadow-lg"
          >
            <Text className="text-center text-sm font-semibold text-white">はじめる</Text>
          </Pressable>
          <Text className="mt-4 text-center text-[11px] leading-relaxed text-white/40">
            本アプリは医療・診断を目的としたものではありません
          </Text>
        </ScrollView>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="px-4 pb-10 pt-8">
      <View className="mb-8 flex-row items-center gap-2">
        {STEPS.map((_, i) => {
          const stepIndex = i + 1;
          return (
            <View key={i} className="flex-1 flex-row items-center gap-2">
              <View
                className={`h-6 w-6 items-center justify-center rounded-full ${stepIndex <= step ? 'bg-primary' : 'bg-secondary'}`}
              >
                {stepIndex < step ? (
                  <Icon name="check" size={13} color="#FFFFFF" />
                ) : (
                  <Text className={`text-xs font-bold ${stepIndex <= step ? 'text-white' : 'text-muted-foreground'}`}>
                    {i + 1}
                  </Text>
                )}
              </View>
              {i < STEPS.length - 1 && (
                <View className={`h-0.5 flex-1 rounded-full ${stepIndex < step ? 'bg-primary' : 'bg-secondary'}`} />
              )}
            </View>
          );
        })}
      </View>

      {step === 1 && (
        <View>
          <View className="mb-6">
            <Text className="mb-1 text-xl font-bold text-foreground">心を満たすものを選ぼう</Text>
            <Text className="text-sm text-muted-foreground">
              3〜8個がおすすめ{selected.size > 0 ? `　${selected.size}個選択中` : ''}
            </Text>
          </View>
          <View className="gap-5">
            {Object.entries(grouped).map(([group, cats]) => (
              <View key={group}>
                <Text className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {group}
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {cats.map((cat) => {
                    const isSelected = selected.has(cat.id);
                    return (
                      <Pressable
                        key={cat.id}
                        onPress={() =>
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (next.has(cat.id)) next.delete(cat.id);
                            else next.add(cat.id);
                            return next;
                          })
                        }
                        style={isSelected ? { backgroundColor: cat.color, borderColor: cat.color } : undefined}
                        className={`flex-row items-center gap-1.5 rounded-full border-2 px-3.5 py-2 ${isSelected ? '' : 'border-border bg-white'}`}
                      >
                        {isSelected && <Icon name="check" size={14} color="#FFFFFF" />}
                        <Text className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-foreground'}`}>
                          {cat.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>

          <Pressable
            onPress={() => bulkMutation.mutate(Array.from(selected))}
            disabled={selected.size < 1 || bulkMutation.isPending}
            className={`mt-8 rounded-xl bg-accent py-3.5 ${selected.size < 1 || bulkMutation.isPending ? 'opacity-50' : ''}`}
          >
            <Text className="text-center text-sm font-semibold text-white">
              {bulkMutation.isPending ? '保存中…' : '次へ'}
            </Text>
          </Pressable>
        </View>
      )}

      {step === 2 && (
        <View>
          <View className="mb-6">
            <Text className="mb-1 text-xl font-bold text-foreground">この1ヶ月をふりかえろう</Text>
            <Text className="text-sm leading-relaxed text-muted-foreground">
              それぞれ、どれくらいあなたの心を満たしてくれましたか？
            </Text>
          </View>

          <View className="gap-3">
            {myCategories.map((cat) => {
              const level = baselineLevels[cat.id];
              return (
                <View key={cat.id} className="rounded-2xl border border-border bg-white p-4 shadow-sm">
                  <View className="mb-3 flex-row items-center gap-2.5">
                    <View className="h-3 w-3 rounded-full" style={{ backgroundColor: cat.color }} />
                    <Text className="text-sm font-medium text-foreground">{cat.name}</Text>
                  </View>
                  <View className="flex-row gap-2">
                    {BASELINE_LEVELS.map(({ value, label }) => (
                      <Pressable
                        key={value}
                        onPress={() => setBaselineLevels((prev) => ({ ...prev, [cat.id]: value }))}
                        className={`flex-1 rounded-xl border py-2 ${level === value ? 'border-primary bg-primary' : 'border-transparent bg-secondary'}`}
                      >
                        <Text
                          className={`text-center text-xs font-semibold ${level === value ? 'text-white' : 'text-muted-foreground'}`}
                        >
                          {label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              );
            })}
          </View>

          <Pressable
            onPress={() => baselineMutation.mutate()}
            disabled={!allAnswered || baselineMutation.isPending}
            className={`mt-8 rounded-xl bg-accent py-3.5 ${!allAnswered || baselineMutation.isPending ? 'opacity-50' : ''}`}
          >
            <Text className="text-center text-sm font-semibold text-white">
              {baselineMutation.isPending ? '診断中…' : allAnswered ? 'ポートフォリオを見る' : 'すべて答えてください'}
            </Text>
          </Pressable>
        </View>
      )}

      {step === 3 && (
        <View>
          <View className="mb-6 items-center">
            <Text className="mb-2 text-center text-xl font-bold text-foreground">
              これがいまの、{'\n'}あなたの心のバランスです
            </Text>
            <Text className="text-center text-sm leading-relaxed text-muted-foreground">
              毎日の記録で、すこしずつ実際のデータに置き換わっていきます
            </Text>
          </View>

          <View className="rounded-2xl border border-border bg-white p-5 shadow-sm">
            {portfolio ? (
              <PortfolioPie breakdown={portfolio.breakdown} />
            ) : (
              <View className="h-40 items-center justify-center">
                <Text className="text-sm text-muted-foreground">読み込み中…</Text>
              </View>
            )}
          </View>

          {portfolio && portfolio.breakdown[0] && (
            <Text className="mt-4 text-center text-sm leading-relaxed text-muted-foreground">
              いまのあなたは「
              <Text className="font-semibold text-foreground">{portfolio.breakdown[0].categoryName}</Text>
              」が {portfolio.breakdown[0].percentage}% を支えています
            </Text>
          )}

          <Pressable
            onPress={() => onboardingMutation.mutate()}
            disabled={onboardingMutation.isPending}
            className={`mt-8 rounded-xl bg-accent py-3.5 ${onboardingMutation.isPending ? 'opacity-50' : ''}`}
          >
            <Text className="text-center text-sm font-semibold text-white">
              {onboardingMutation.isPending ? 'はじめています…' : 'ダッシュボードへ'}
            </Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}
