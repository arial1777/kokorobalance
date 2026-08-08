import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '@/lib/api';
import { todayJST } from '@/lib/utils';
import { Icon } from '@/components/ui/icon';
import { AppHeader } from '@/components/ui/app-header';
import { PillarSections } from '@/components/pillar-sections';
import { PillarMigrationNotice } from '@/components/pillar-migration-notice';
import type { CurrentWeeklyCheckResult, Portfolio, Profile, ShakeEvent } from '@/types';

export default function DashboardPage() {
  const router = useRouter();

  const { data: current } = useQuery<CurrentWeeklyCheckResult>({
    queryKey: ['weekly-check-current'],
    queryFn: () => api.get<CurrentWeeklyCheckResult>('/weekly-check/current'),
  });

  const { data: profile } = useQuery<Profile>({
    queryKey: ['profile'],
    queryFn: () => api.get<Profile>('/profile'),
  });

  const { data: portfolio } = useQuery<Portfolio>({
    queryKey: ['portfolio', 30],
    queryFn: () => api.get<Portfolio>('/portfolio?period=30'),
  });

  const { data: shakeEvents = [] } = useQuery<ShakeEvent[]>({
    queryKey: ['shake-events'],
    queryFn: () => api.get<ShakeEvent[]>('/shake/events'),
  });

  // 直近(D-3〜D+3)の揺れそうな日を1件だけ拾う（ホーム画面自体の再構成は06連動のため対象外）
  const calendarToday = todayJST();
  const nearbyShake = shakeEvents
    .filter((e) => e.status !== 'archived' && e.isDateCertain)
    .filter((e) => {
      const diff = Math.round(
        (new Date(`${e.eventDate}T00:00:00`).getTime() - new Date(`${calendarToday}T00:00:00`).getTime()) / 86400000,
      );
      return diff >= -3 && diff <= 3;
    })
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate))[0];

  const isCheckedThisWeek = !!current?.completedAt;
  const selectedCategoryNames = current
    ? current.entries
        .map((e) => current.categories.find((c) => c.id === e.categoryId)?.name)
        .filter((n): n is string => !!n)
    : [];

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
            今週の点検
          </Text>
          {isCheckedThisWeek ? (
            <>
              <View className="mb-3 flex-row items-center gap-2">
                <Icon name="check_circle" filled size={16} color="#FFFFFF" />
                <Text className="text-sm font-medium text-white">今週の点検は済んでいます</Text>
              </View>
              {selectedCategoryNames.length > 0 && (
                <View className="mb-1 flex-row flex-wrap gap-1.5">
                  {selectedCategoryNames.map((name) => (
                    <Text key={name} className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium text-white/90">
                      {name}
                    </Text>
                  ))}
                </View>
              )}
              <Pressable onPress={() => router.push('/record')} className="mt-4 flex-row items-center gap-1">
                <Icon name="edit" size={14} color="#FFFFFF" />
                <Text className="text-xs text-white/60">編集する</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text className="mb-1 text-lg font-semibold text-white">この1週間、支えになったのは？</Text>
              <Text className="mb-5 text-xs text-white/50">タップだけ、30秒で点検できます</Text>
              <Pressable
                onPress={() => router.push('/record')}
                className="flex-row items-center gap-1.5 self-start rounded-full bg-[#E05A3A] px-5 py-2.5"
              >
                <Icon name="edit" size={16} color="#FFFFFF" />
                <Text className="text-sm font-semibold text-white">点検する</Text>
              </Pressable>
            </>
          )}
        </LinearGradient>

        {nearbyShake && (
          <Pressable
            onPress={() => router.push(`/shake/${nearbyShake.id}`)}
            className="flex-row items-center gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4"
          >
            <View className="h-9 w-9 items-center justify-center rounded-full bg-sky-100">
              <Icon name="thunderstorm" size={18} color="#0369a1" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-sky-900" numberOfLines={1}>
                {nearbyShake.title}
              </Text>
              <Text className="mt-0.5 text-xs text-sky-700">揺れ予報を見る</Text>
            </View>
            <Icon name="chevron_right" size={18} color="#0369a1" />
          </Pressable>
        )}

        <PillarMigrationNotice profile={profile} />

        {/* 柱（確かな柱 / 育て中 / 習慣）。本数は出さない（07 §3.5 P-01） */}
        {portfolio && <PillarSections pillars={portfolio.pillars} />}

        <LinearGradient colors={['#1e293b', '#334155']} style={{ borderRadius: 20, padding: 20 }}>
          <View className="mb-1 flex-row items-center gap-2">
            <Icon name="smart_toy" size={16} color="#FFFFFF" />
            <Text className="text-xs font-semibold uppercase tracking-wider text-white/80">壁打ち</Text>
          </View>
          <Text className="mb-0.5 font-semibold text-white">考えを整理する相手</Text>
          <Text className="text-xs text-white/70">いま思っていることを、そのまま話してみませんか</Text>
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
