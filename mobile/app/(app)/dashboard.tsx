import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '@/lib/api';
import { todayJST } from '@/lib/utils';
import { PortfolioPie } from '@/components/charts/portfolio-pie';
import { Icon } from '@/components/ui/icon';
import { AppHeader } from '@/components/ui/app-header';
import type { DailyRecord, PillarStage, Portfolio } from '@/types';

const STAGE_META: Record<PillarStage, { emoji: string; label: string }> = {
  sprout: { emoji: '🌱', label: '芽' },
  young: { emoji: '🌿', label: '若木' },
  pillar: { emoji: '🏛️', label: '柱' },
};

export default function DashboardPage() {
  const router = useRouter();
  const today = todayJST();

  const { data: todayRecord } = useQuery<DailyRecord | null>({
    queryKey: ['record', today],
    queryFn: () => api.get<DailyRecord>(`/records/${today}`),
  });

  const { data: portfolio } = useQuery<Portfolio>({
    queryKey: ['portfolio', 30],
    queryFn: () => api.get<Portfolio>('/portfolio?period=30'),
  });

  const todaysItems = todayRecord?.items ?? [];
  const hasRecordedToday = todaysItems.length > 0;

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        title="ホーム"
        right={
          <Pressable
            onPress={() => router.push('/settings')}
            className="h-9 w-9 items-center justify-center rounded-xl active:bg-secondary"
          >
            <Icon name="settings" size={20} color="#6B5848" />
          </Pressable>
        }
      />
      <ScrollView contentContainerClassName="gap-5 px-4 pb-8 pt-5">
        <LinearGradient
          colors={['#1A3352', '#0F1F35']}
          style={{ borderRadius: 20, padding: 24 }}
        >
          <Text className="mb-3 text-xs font-medium uppercase tracking-wider text-white/60">
            今日のあなたの柱
          </Text>
          {hasRecordedToday ? (
            <>
              <View className="mb-4 flex-row items-end justify-between">
                <Text className="text-6xl font-bold leading-none tracking-tight text-white">
                  {todaysItems.length}
                  <Text className="ml-1 text-xl font-semibold text-white/60">本</Text>
                </Text>
                <View className="flex-row items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5">
                  <Icon name="check_circle" filled size={16} color="#FFFFFF" />
                  <Text className="text-xs font-medium text-white">記録済み</Text>
                </View>
              </View>
              <View className="flex-row flex-wrap gap-1.5">
                {todaysItems.map((item) => (
                  <Text
                    key={item.id}
                    className="rounded-full px-2.5 py-1 text-xs font-medium text-white/90"
                    style={{ backgroundColor: `${item.category.color}66` }}
                  >
                    {item.category.name}
                  </Text>
                ))}
              </View>
              <Pressable onPress={() => router.push('/record')} className="mt-4 flex-row items-center gap-1">
                <Icon name="edit" size={14} color="#FFFFFF" />
                <Text className="text-xs text-white/60">記録を編集する</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text className="mb-1 text-lg font-semibold text-white">今日は何があなたを支えましたか？</Text>
              <Text className="mb-5 text-xs text-white/50">タップだけ、10秒で記録できます</Text>
              <Pressable
                onPress={() => router.push('/record')}
                className="flex-row items-center gap-1.5 self-start rounded-full bg-[#E05A3A] px-5 py-2.5"
              >
                <Icon name="edit" size={16} color="#FFFFFF" />
                <Text className="text-sm font-semibold text-white">記録する</Text>
              </Pressable>
            </>
          )}
        </LinearGradient>

        {portfolio?.suggestion.exists && (
          <View className="flex-row gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <View className="h-8 w-8 items-center justify-center rounded-full bg-emerald-100">
              <Text className="text-base">🌱</Text>
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-emerald-800">次に育てる柱</Text>
              <Text className="mt-0.5 text-xs leading-relaxed text-emerald-700">
                {portfolio.suggestion.message}
              </Text>
            </View>
          </View>
        )}

        {portfolio && (
          <View className="rounded-2xl border border-border bg-white p-5 shadow-sm">
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                いまのあなたの柱
              </Text>
              <Text className="text-sm font-bold text-primary">{portfolio.pillars.count}本</Text>
            </View>
            {portfolio.pillars.items.length > 0 ? (
              <View className="gap-2.5">
                {portfolio.pillars.items.map((p) => (
                  <View key={p.categoryName} className="flex-row items-center gap-3">
                    <Text className="w-7 text-center text-lg">{STAGE_META[p.stage].emoji}</Text>
                    <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                    <Text className="flex-1 text-sm font-medium text-foreground">{p.categoryName}</Text>
                    <Text className="text-xs text-muted-foreground">
                      {STAGE_META[p.stage].label}・週{p.weeklyFrequency}回
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text className="text-sm leading-relaxed text-muted-foreground">
                まだ柱がありません。毎日の記録で、あなたを支える柱を育てましょう 🌱
              </Text>
            )}
          </View>
        )}

        <View className="rounded-2xl border border-border bg-white p-5 shadow-sm">
          <View className="mb-4 flex-row items-center justify-between">
            <View>
              <Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                過去30日
              </Text>
              <Text className="mt-0.5 font-semibold text-foreground">心のポートフォリオ</Text>
            </View>
            <Pressable onPress={() => router.push('/portfolio')} className="flex-row items-center gap-0.5">
              <Text className="text-xs font-medium text-accent">詳しく</Text>
              <Icon name="chevron_right" size={16} color="#E05A3A" />
            </Pressable>
          </View>
          <PortfolioPie breakdown={portfolio?.breakdown ?? []} compact />
          {portfolio?.isBlended && (
            <Text className="mt-2 text-center text-[11px] text-muted-foreground">
              はじめの診断を含む表示です。記録を重ねると実データに置き換わります
            </Text>
          )}
        </View>

        <LinearGradient colors={['#1e293b', '#334155']} style={{ borderRadius: 20, padding: 20 }}>
          <View className="mb-1 flex-row items-center gap-2">
            <Icon name="smart_toy" size={16} color="#FFFFFF" />
            <Text className="text-xs font-semibold uppercase tracking-wider text-white/80">AIコーチ</Text>
            <View className="rounded-full bg-accent px-2 py-0.5">
              <Text className="text-[10px] font-semibold text-white">Pro</Text>
            </View>
          </View>
          <Text className="mb-0.5 font-semibold text-white">あなた専用のアドバイス</Text>
          <Text className="text-xs text-white/70">ポートフォリオを分析して、心のバランスを提案します</Text>
          <Pressable
            onPress={() => router.push('/coach')}
            className="mt-4 flex-row items-center gap-1.5 self-start rounded-xl bg-white px-4 py-2"
          >
            <Text className="text-sm font-semibold text-slate-800">話しかける</Text>
            <Icon name="chevron_right" size={16} color="#1e293b" />
          </Pressable>
        </LinearGradient>
      </ScrollView>
    </View>
  );
}
