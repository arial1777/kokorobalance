import { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { track } from '@/lib/analytics';
import { Icon } from '@/components/ui/icon';
import { AppHeader } from '@/components/ui/app-header';
import type { FluctuationMagnitude, Profile, WeeklyReport } from '@/types';

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://kokorobalance.example.com';

const MAGNITUDE_LABEL: Record<FluctuationMagnitude, string> = {
  small: '小',
  medium: '中',
  large: '大',
};

function formatWeek(date: string): string {
  return `${date.slice(5).replace('-', '/')}の週`;
}

export default function WeeklySummaryScreen() {
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);

  const { data: profile } = useQuery<Profile>({
    queryKey: ['profile'],
    queryFn: () => api.get<Profile>('/profile'),
  });

  const { data: reports = [], isLoading } = useQuery<WeeklyReport[]>({
    queryKey: ['reports'],
    queryFn: () => api.get<WeeklyReport[]>('/reports'),
  });

  const report = selectedWeek
    ? (reports.find((r) => r.weekStartDate === selectedWeek) ?? reports[0])
    : reports[0];

  useEffect(() => {
    if (report) track('report_viewed', { week: report.weekStartDate });
  }, [report?.id]);

  const categoryRows = report
    ? Object.entries(report.categoryBreakdown)
        .map(([name, pct]) => ({ name, pct }))
        .sort((a, b) => b.pct - a.pct)
    : [];

  const fluctuations = report?.fluctuationSummary;

  return (
    <View className="flex-1 bg-background">
      <AppHeader title="今週のまとめ" subtitle="ふりかえり" />
      <ScrollView contentContainerClassName="px-4 pb-8 pt-5">
        {isLoading && <Text className="text-center text-sm text-muted-foreground">読み込み中...</Text>}

        {reports.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="mb-4 gap-2">
            {reports.map((r) => (
              <Pressable
                key={r.id}
                onPress={() => setSelectedWeek(r.weekStartDate)}
                className={`rounded-full border px-3.5 py-1.5 ${report?.id === r.id ? 'border-primary bg-primary' : 'border-border bg-white'}`}
              >
                <Text className={`text-xs font-semibold ${report?.id === r.id ? 'text-white' : 'text-muted-foreground'}`}>
                  {formatWeek(r.weekStartDate)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {report ? (
          <View className="gap-4">
            <View className="rounded-2xl border border-border bg-white p-5 shadow-sm">
              <Text className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {formatWeek(report.weekStartDate)}・支えになったもの
              </Text>
              {categoryRows.length > 0 ? (
                <View className="gap-3">
                  {categoryRows.map(({ name, pct }) => (
                    <View key={name} className="flex-row items-center gap-3">
                      <Text className="flex-1 text-sm font-medium text-foreground">{name}</Text>
                      <View className="h-2 w-24 overflow-hidden rounded-full bg-secondary">
                        <View className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <Text className="text-sm leading-relaxed text-muted-foreground">そういう週もあります。</Text>
              )}
            </View>

            {fluctuations && fluctuations.count > 0 && (
              <View className="rounded-2xl border border-border bg-white p-5 shadow-sm">
                <Text className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  心が揺れた出来事（{fluctuations.count}件）
                </Text>
                <View className="gap-2">
                  {fluctuations.events.map((e, i) => (
                    <View key={i} className="flex-row items-center gap-2.5">
                      <Text>💧</Text>
                      <Text className="text-xs font-semibold text-sky-700">揺れ・{MAGNITUDE_LABEL[e.magnitude]}</Text>
                      {e.categoryName && <Text className="text-xs text-muted-foreground">{e.categoryName}</Text>}
                      {e.note && (
                        <Text numberOfLines={1} className="flex-1 text-xs text-muted-foreground">
                          {e.note}
                        </Text>
                      )}
                      <Text className="ml-auto text-[11px] text-muted-foreground">
                        {e.occurredDate.slice(5).replace('-', '/')}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {report.aiComment ? (
              <View className="rounded-2xl border border-border bg-white p-5 shadow-sm">
                <View className="mb-3 flex-row items-center gap-2">
                  <View className="h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                    <Icon name="smart_toy" filled size={16} color="#1A3352" />
                  </View>
                  <Text className="text-xs font-semibold text-primary">今週のひとこと</Text>
                </View>
                <Text className="text-sm leading-relaxed text-foreground">{report.aiComment}</Text>
              </View>
            ) : profile?.plan !== 'pro' ? (
              <View className="items-center rounded-2xl border border-border bg-white p-5 shadow-sm">
                <View className="mb-3 h-10 w-10 items-center justify-center rounded-xl bg-secondary">
                  <Icon name="lock" filled size={20} color="#6B5848" />
                </View>
                <Text className="mb-3 text-sm text-muted-foreground">今週のひとこと（AI）はProプランで読めます</Text>
                <Pressable onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/pricing`)}>
                  <Text className="text-xs font-semibold text-accent">アップグレード →</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : !isLoading ? (
          <View className="items-center py-16">
            <Text className="text-sm text-muted-foreground">今週の点検をすると、ここにまとめが表示されます</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
