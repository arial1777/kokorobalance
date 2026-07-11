import { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { track } from '@/lib/analytics';
import { Icon } from '@/components/ui/icon';
import { AppHeader } from '@/components/ui/app-header';
import type { FluctuationMagnitude, GenerateReportResult, Profile, WeeklyReport } from '@/types';

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://kokorobalance.example.com';

const MAGNITUDE_LABEL: Record<FluctuationMagnitude, string> = {
  small: '小',
  medium: '中',
  large: '大',
};

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

function formatWeek(date: string): string {
  return `${date.slice(5).replace('-', '/')}の週`;
}

function Delta({ value, suffix = '' }: { value: number; suffix?: string }) {
  if (value === 0) return <Text className="text-xs text-muted-foreground">±0{suffix}</Text>;
  const up = value > 0;
  return (
    <Text className={`text-xs font-semibold ${up ? 'text-emerald-600' : 'text-rose-500'}`}>
      {up ? '▲' : '▼'}
      {Math.abs(Math.round(value * 10) / 10)}
      {suffix}
    </Text>
  );
}

export default function ReportPage() {
  const qc = useQueryClient();
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const [generateInfo, setGenerateInfo] = useState<string | null>(null);

  const { data: profile } = useQuery<Profile>({
    queryKey: ['profile'],
    queryFn: () => api.get<Profile>('/profile'),
  });

  const { data: reports = [], isLoading } = useQuery<WeeklyReport[]>({
    queryKey: ['reports'],
    queryFn: () => api.get<WeeklyReport[]>('/reports'),
  });

  const generateMutation = useMutation({
    mutationFn: () => api.post<GenerateReportResult>('/reports/generate'),
    onSuccess: (result) => {
      if (result.generated) {
        setGenerateInfo(null);
        qc.invalidateQueries({ queryKey: ['reports'] });
        if (result.report) setSelectedWeek(result.report.weekStartDate);
      } else {
        setGenerateInfo(
          `今週の記録はまだ${result.recordDays ?? 0}日です。2日以上記録するとレポートを作れます。`,
        );
      }
    },
  });

  const report = selectedWeek
    ? (reports.find((r) => r.weekStartDate === selectedWeek) ?? reports[0])
    : reports[0];

  useEffect(() => {
    if (report) track('report_viewed', { week: report.weekStartDate });
  }, [report?.id]);

  const previous = report
    ? reports.find((r) => r.weekStartDate === addDays(report.weekStartDate, -7))
    : undefined;

  const categoryRows = report
    ? (() => {
        const names = new Set([
          ...Object.keys(report.categoryBreakdown),
          ...(previous ? Object.keys(previous.categoryBreakdown) : []),
        ]);
        return Array.from(names)
          .map((name) => ({
            name,
            pct: report.categoryBreakdown[name] ?? 0,
            prev: previous?.categoryBreakdown[name],
          }))
          .sort((a, b) => b.pct - a.pct);
      })()
    : [];

  const decreased = previous
    ? categoryRows
        .filter((r) => r.prev !== undefined)
        .map((r) => ({ name: r.name, delta: r.pct - (r.prev ?? 0) }))
        .sort((a, b) => a.delta - b.delta)[0]
    : undefined;
  const templateHint =
    decreased && decreased.delta < 0
      ? `先週より「${decreased.name}」が減っています。今週、5分だけ触れてみませんか？`
      : null;

  const fluctuations = report?.fluctuationSummary;

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        title="週間レポート"
        subtitle="分析"
        right={
          <Pressable
            onPress={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="flex-row items-center gap-1"
          >
            <Icon name="refresh" size={16} color="#E05A3A" />
            <Text className="text-xs font-semibold text-accent">
              {generateMutation.isPending ? '生成中...' : '更新'}
            </Text>
          </Pressable>
        }
      />
      <ScrollView contentContainerClassName="px-4 pb-8 pt-5">
        {isLoading && <Text className="text-center text-sm text-muted-foreground">読み込み中...</Text>}

        {generateInfo && (
          <View className="mb-4 flex-row gap-2.5 rounded-2xl border border-sky-100 bg-sky-50 p-4">
            <Icon name="info" size={18} color="#0EA5E9" />
            <Text className="flex-1 text-xs leading-relaxed text-sky-700">{generateInfo}</Text>
          </View>
        )}

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
              <Text className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {formatWeek(report.weekStartDate)}
              </Text>
              <View className="flex-row gap-8">
                <View>
                  <Text className="mb-0.5 text-xs text-muted-foreground">充足度</Text>
                  <View className="flex-row items-end gap-2">
                    <Text className="text-3xl font-bold text-primary">
                      {report.fulfillmentTotal}
                      <Text className="ml-0.5 text-sm font-normal text-muted-foreground">pt</Text>
                    </Text>
                    {previous && (
                      <View className="pb-1">
                        <Delta value={report.fulfillmentTotal - previous.fulfillmentTotal} suffix="pt" />
                      </View>
                    )}
                  </View>
                </View>
                <View>
                  <Text className="mb-0.5 text-xs text-muted-foreground">心の柱</Text>
                  <Text className="text-3xl font-bold text-foreground">
                    {report.pillarCount}
                    <Text className="ml-0.5 text-sm font-normal text-muted-foreground">本</Text>
                  </Text>
                </View>
              </View>
            </View>

            <View className="rounded-2xl border border-border bg-white p-5 shadow-sm">
              <Text className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                カテゴリ内訳{previous ? '（前週比）' : ''}
              </Text>
              <View className="gap-3">
                {categoryRows.map(({ name, pct, prev }) => (
                  <View key={name}>
                    <View className="mb-1 flex-row items-center justify-between">
                      <Text className="text-sm font-medium text-foreground">{name}</Text>
                      <View className="flex-row items-center gap-2">
                        {prev !== undefined ? (
                          <Delta value={pct - prev} suffix="%" />
                        ) : previous ? (
                          <Text className="text-xs font-semibold text-sky-600">NEW</Text>
                        ) : null}
                        <Text className="w-12 text-right font-semibold text-primary">{pct}%</Text>
                      </View>
                    </View>
                    <View className="h-2 overflow-hidden rounded-full bg-secondary">
                      <View className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {fluctuations && fluctuations.count > 0 && (
              <View className="rounded-2xl border border-border bg-white p-5 shadow-sm">
                <Text className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  今週、心が揺れた出来事（{fluctuations.count}件）
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
                  <Text className="text-xs font-semibold text-primary">AIコーチからのコメント</Text>
                </View>
                <Text className="text-sm leading-relaxed text-foreground">{report.aiComment}</Text>
              </View>
            ) : profile?.plan !== 'pro' ? (
              <>
                {templateHint && (
                  <View className="flex-row gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <Text className="text-base">🌱</Text>
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-emerald-800">来週へのヒント</Text>
                      <Text className="mt-0.5 text-xs leading-relaxed text-emerald-700">{templateHint}</Text>
                    </View>
                  </View>
                )}
                <View className="items-center rounded-2xl border border-border bg-white p-5 shadow-sm">
                  <View className="mb-3 h-10 w-10 items-center justify-center rounded-xl bg-secondary">
                    <Icon name="lock" filled size={20} color="#6B5848" />
                  </View>
                  <Text className="mb-3 text-sm text-muted-foreground">
                    あなた専用のAIコメントはProプランで読めます
                  </Text>
                  <Pressable onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/pricing`)}>
                    <Text className="text-xs font-semibold text-accent">アップグレード →</Text>
                  </Pressable>
                </View>
              </>
            ) : null}
          </View>
        ) : !isLoading ? (
          <View className="items-center py-16">
            <View className="mb-4 h-16 w-16 items-center justify-center rounded-2xl bg-secondary">
              <Icon name="description" size={32} color="#6B5848" />
            </View>
            <Text className="mb-1 text-sm text-muted-foreground">まだレポートがありません</Text>
            <Text className="mb-4 text-xs text-muted-foreground">週に2日以上記録するとレポートを作れます</Text>
            <Pressable
              onPress={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              className={`rounded-xl bg-accent px-5 py-2.5 shadow-sm ${generateMutation.isPending ? 'opacity-50' : ''}`}
            >
              <Text className="text-sm font-semibold text-white">
                {generateMutation.isPending ? '生成中...' : '最初のレポートを生成'}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
