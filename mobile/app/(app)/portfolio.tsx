import { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { todayJST } from '@/lib/utils';
import { PortfolioPie } from '@/components/charts/portfolio-pie';
import { PortfolioBarHorizontal } from '@/components/charts/portfolio-bar';
import { Icon } from '@/components/ui/icon';
import { AppHeader } from '@/components/ui/app-header';
import { PillarSections } from '@/components/pillar-sections';
import type { FluctuationEvent, FluctuationMagnitude, Portfolio } from '@/types';

const PERIODS = [
  { label: '7日', value: 7 },
  { label: '30日', value: 30 },
  { label: '90日', value: 90 },
] as const;

/** 点検4回未満は構成の表示をしない（06-spec-weekly-check.md W-11、原則4） */
const MIN_CHECKS_FOR_CHART = 4;

const MAGNITUDE_META: Record<FluctuationMagnitude, { label: string; size: number }> = {
  small: { label: '小', size: 14 },
  medium: { label: '中', size: 16 },
  large: { label: '大', size: 18 },
};

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export default function PortfolioPage() {
  const [period, setPeriod] = useState<7 | 30 | 90>(30);
  const [view, setView] = useState<'pie' | 'bar'>('pie');
  const today = todayJST();
  const from = addDays(today, -(period - 1));

  const { data: portfolio } = useQuery<Portfolio>({
    queryKey: ['portfolio', period],
    queryFn: () => api.get<Portfolio>(`/portfolio?period=${period}`),
  });

  const { data: fluctuations = [] } = useQuery<FluctuationEvent[]>({
    queryKey: ['fluctuations', from, today],
    queryFn: () => api.get<FluctuationEvent[]>(`/records/fluctuations?from=${from}&to=${today}`),
  });

  const hasEnoughChecks = (portfolio?.totalRecordDays ?? 0) >= MIN_CHECKS_FOR_CHART;

  return (
    <View className="flex-1 bg-background">
      <AppHeader title="心のポートフォリオ" subtitle="分析" />
      <ScrollView contentContainerClassName="px-4 pb-8 pt-5">
        <View className="mb-5 flex-row gap-2 rounded-xl bg-secondary p-1">
          {PERIODS.map((p) => (
            <Pressable
              key={p.value}
              onPress={() => setPeriod(p.value)}
              className={`flex-1 rounded-lg py-2 ${period === p.value ? 'bg-white' : ''}`}
            >
              <Text className={`text-center text-sm font-semibold ${period === p.value ? 'text-primary' : 'text-muted-foreground'}`}>
                {p.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {hasEnoughChecks ? (
          <>
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                バランス（割合）
              </Text>
              <View className="flex-row gap-1">
                {(['pie', 'bar'] as const).map((v) => (
                  <Pressable
                    key={v}
                    onPress={() => setView(v)}
                    className={`rounded-lg px-3 py-1 ${view === v ? 'bg-primary/10' : ''}`}
                  >
                    <Icon name={v === 'pie' ? 'donut_large' : 'bar_chart'} size={18} color={view === v ? '#1A3352' : '#6B5848'} />
                  </Pressable>
                ))}
              </View>
            </View>

            <View className="mb-4 rounded-2xl border border-border bg-white p-5 shadow-sm">
              {view === 'pie' ? (
                <PortfolioPie breakdown={portfolio?.breakdown ?? []} />
              ) : (
                <PortfolioBarHorizontal breakdown={portfolio?.breakdown ?? []} />
              )}
              {portfolio?.isBlended && (
                <Text className="mt-2 text-center text-[11px] text-muted-foreground">
                  はじめの診断を含む表示です。点検を重ねると実データに置き換わります
                </Text>
              )}
            </View>

            {portfolio && portfolio.breakdown.length > 0 && (
              <View className="mb-6 gap-2">
                {portfolio.breakdown.map((item, i) => (
                  <View key={i} className="flex-row items-center gap-3 rounded-xl border border-border bg-white p-3.5 shadow-sm">
                    <Text className="w-5 text-xs font-bold text-muted-foreground">{i + 1}</Text>
                    <View className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <Text className="flex-1 text-sm font-medium text-foreground">{item.categoryName}</Text>
                    <View className="flex-row items-center gap-2">
                      <View className="h-1.5 w-20 overflow-hidden rounded-full bg-secondary">
                        <View className="h-full rounded-full" style={{ width: `${item.percentage}%`, backgroundColor: item.color }} />
                      </View>
                      <Text className="w-10 text-right text-sm font-bold text-foreground">{item.percentage}%</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        ) : (
          <View className="mb-4 items-center rounded-2xl border border-border bg-white p-6 shadow-sm">
            <Text className="text-center text-sm leading-relaxed text-muted-foreground">
              あと{Math.max(0, MIN_CHECKS_FOR_CHART - (portfolio?.totalRecordDays ?? 0))}回の点検で、構成が表示されます
            </Text>
          </View>
        )}

        {/* 柱（確かな柱 / 育て中 / 習慣）。ふりかえり側にだけ置く（07 §3.5 P-01/P-02） */}
        {portfolio && (
          <View className="mb-6">
            <PillarSections pillars={portfolio.pillars} />
          </View>
        )}

        {fluctuations.length > 0 && (
          <>
            <Text className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              心が揺れた出来事
            </Text>
            <View className="gap-2">
              {fluctuations.map((f) => (
                <View key={f.id} className="flex-row items-center gap-3 rounded-xl border border-border bg-white p-3.5 shadow-sm">
                  <Text style={{ fontSize: MAGNITUDE_META[f.magnitude].size }}>💧</Text>
                  <View className="min-w-0 flex-1">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-xs font-semibold text-sky-700">
                        揺れ・{MAGNITUDE_META[f.magnitude].label}
                      </Text>
                      {f.category && <Text className="text-xs text-muted-foreground">{f.category.name}</Text>}
                    </View>
                    {f.note && (
                      <Text numberOfLines={1} className="mt-0.5 text-xs text-muted-foreground">
                        {f.note}
                      </Text>
                    )}
                  </View>
                  <Text className="text-[11px] text-muted-foreground">
                    {f.occurredDate.slice(5).replace('-', '/')}
                  </Text>
                </View>
              ))}
            </View>
            <Text className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              揺らぎは割合には入りません。心が動いた出来事のふりかえりに使われます。
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}
