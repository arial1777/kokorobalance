'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api';
import { todayJST } from '@/lib/utils';
import { Icon } from '@/components/ui/icon';
import { AppHeader } from '@/components/layout/app-header';
import { PillarSections } from '@/components/pillar-sections';
import { PillarMigrationNotice } from '@/components/pillar-migration-notice';
import type { CurrentWeeklyCheckResult, Portfolio, Profile, ShakeEvent } from '@/types';

export default function DashboardPage() {
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

  const headerRight = (
    <Link href="/settings" className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-secondary transition text-muted-foreground hover:text-foreground">
      <Icon name="settings" className="text-xl" />
    </Link>
  );

  return (
    <>
      <AppHeader title="ホーム" right={headerRight} />
      <div className="px-4 pt-5 pb-6 space-y-5">

      {/* 今週の点検 ヒーローカード */}
      <div className="rounded-2xl p-6 bg-gradient-to-br from-[#1A3352] to-[#0F1F35] text-white shadow-lg shadow-black/10">
        <p className="text-xs font-medium opacity-60 mb-3 uppercase tracking-wider">今週の点検</p>
        {isCheckedThisWeek ? (
          <>
            <div className="flex items-center gap-2 mb-3">
              <Icon name="check_circle" filled className="text-lg" />
              <span className="text-sm font-medium">今週の点検は済んでいます</span>
            </div>
            {selectedCategoryNames.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-1">
                {selectedCategoryNames.map((name) => (
                  <span key={name} className="px-2.5 py-1 rounded-full text-xs font-medium text-white/90 bg-white/15">
                    {name}
                  </span>
                ))}
              </div>
            )}
            <Link href="/record" className="inline-flex items-center gap-1 text-xs opacity-60 hover:opacity-90 transition mt-4">
              <Icon name="edit" className="text-sm" />
              編集する
            </Link>
          </>
        ) : (
          <>
            <p className="text-lg font-semibold mb-1">この1週間、支えになったのは？</p>
            <p className="text-xs opacity-50 mb-5">タップだけ、30秒で点検できます</p>
            <Link
              href="/record"
              className="inline-flex items-center gap-1.5 bg-[#E05A3A] hover:bg-[#c94d30] rounded-full px-5 py-2.5 transition shadow-sm"
            >
              <Icon name="edit" className="text-base" />
              <span className="text-sm font-semibold">点検する</span>
            </Link>
          </>
        )}
      </div>

      {/* 揺れそうな日への誘導 */}
      {nearbyShake && (
        <Link
          href={`/shake/${nearbyShake.id}`}
          className="flex items-center gap-3 bg-sky-50 border border-sky-200 rounded-2xl p-4 hover:bg-sky-100 transition"
        >
          <div className="flex-shrink-0 w-9 h-9 bg-sky-100 rounded-full flex items-center justify-center">
            <Icon name="thunderstorm" className="text-lg text-sky-700" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-sky-900 truncate">{nearbyShake.title}</p>
            <p className="text-xs text-sky-700 mt-0.5">揺れ予報を見る</p>
          </div>
          <Icon name="chevron_right" className="text-lg text-sky-700" />
        </Link>
      )}

      <PillarMigrationNotice profile={profile} />

      {/* 柱（確かな柱 / 育て中 / 習慣）。本数は出さない（07 §3.5 P-01） */}
      {portfolio && <PillarSections pillars={portfolio.pillars} />}

      {/* 壁打ちカード */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-700 rounded-2xl p-5 text-white shadow-lg shadow-slate-300">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Icon name="smart_toy" className="text-base opacity-80" />
              <span className="text-xs font-semibold opacity-80 uppercase tracking-wider">壁打ち</span>
            </div>
            <p className="font-semibold mb-0.5">考えを整理する相手</p>
            <p className="text-xs opacity-70">いま思っていることを、そのまま話してみませんか</p>
          </div>
        </div>
        <Link
          href="/coach"
          className="mt-4 inline-flex items-center gap-1.5 bg-white text-slate-800 text-sm font-semibold rounded-xl px-4 py-2 hover:bg-slate-100 transition"
        >
          話しかける
          <Icon name="chevron_right" className="text-base" />
        </Link>
      </div>

    </div>
    </>
  );
}
