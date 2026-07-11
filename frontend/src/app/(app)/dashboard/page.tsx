'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api';
import { todayJST } from '@/lib/utils';
import { PortfolioPie } from '@/components/charts/portfolio-pie';
import { Icon } from '@/components/ui/icon';
import { AppHeader } from '@/components/layout/app-header';
import type { DailyRecord, PillarStage, Portfolio } from '@/types';

const STAGE_META: Record<PillarStage, { emoji: string; label: string }> = {
  sprout: { emoji: '🌱', label: '芽' },
  young: { emoji: '🌿', label: '若木' },
  pillar: { emoji: '🏛️', label: '柱' },
};

export default function DashboardPage() {
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

  const headerRight = (
    <Link href="/settings" className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-secondary transition text-muted-foreground hover:text-foreground">
      <Icon name="settings" className="text-xl" />
    </Link>
  );

  return (
    <>
      <AppHeader title="ホーム" right={headerRight} />
      <div className="px-4 pt-5 pb-6 space-y-5">

      {/* 今日の柱 ヒーローカード */}
      <div className="rounded-2xl p-6 bg-gradient-to-br from-[#1A3352] to-[#0F1F35] text-white shadow-lg shadow-black/10">
        <p className="text-xs font-medium opacity-60 mb-3 uppercase tracking-wider">今日のあなたの柱</p>
        {hasRecordedToday ? (
          <>
            <div className="flex items-end justify-between mb-4">
              <p className="text-6xl font-bold tracking-tight leading-none">
                {todaysItems.length}
                <span className="text-xl font-semibold opacity-60 ml-1">本</span>
              </p>
              <div className="flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1.5">
                <Icon name="check_circle" filled className="text-lg" />
                <span className="text-xs font-medium">記録済み</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {todaysItems.map((item) => (
                <span
                  key={item.id}
                  className="px-2.5 py-1 rounded-full text-xs font-medium text-white/90"
                  style={{ backgroundColor: `${item.category.color}66` }}
                >
                  {item.category.name}
                </span>
              ))}
            </div>
            <Link
              href="/record"
              className="inline-flex items-center gap-1 text-xs opacity-60 hover:opacity-90 transition mt-4"
            >
              <Icon name="edit" className="text-sm" />
              記録を編集する
            </Link>
          </>
        ) : (
          <>
            <p className="text-lg font-semibold mb-1">今日は何があなたを支えましたか？</p>
            <p className="text-xs opacity-50 mb-5">タップだけ、10秒で記録できます</p>
            <Link
              href="/record"
              className="inline-flex items-center gap-1.5 bg-[#E05A3A] hover:bg-[#c94d30] rounded-full px-5 py-2.5 transition shadow-sm"
            >
              <Icon name="edit" className="text-base" />
              <span className="text-sm font-semibold">記録する</span>
            </Link>
          </>
        )}
      </div>

      {/* 育成提案 */}
      {portfolio?.suggestion.exists && (
        <div className="flex gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
          <div className="flex-shrink-0 w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
            <span className="text-base">🌱</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-emerald-800">次に育てる柱</p>
            <p className="text-xs text-emerald-700 mt-0.5 leading-relaxed">{portfolio.suggestion.message}</p>
          </div>
        </div>
      )}

      {/* 心の柱 */}
      {portfolio && (
        <div className="bg-white rounded-2xl border border-border shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">いまのあなたの柱</p>
            <p className="text-sm font-bold text-primary">{portfolio.pillars.count}本</p>
          </div>
          {portfolio.pillars.items.length > 0 ? (
            <div className="space-y-2.5">
              {portfolio.pillars.items.map((p) => (
                <div key={p.categoryName} className="flex items-center gap-3">
                  <span className="text-lg w-7 text-center">{STAGE_META[p.stage].emoji}</span>
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                  <span className="text-sm font-medium flex-1">{p.categoryName}</span>
                  <span className="text-xs text-muted-foreground">
                    {STAGE_META[p.stage].label}・週{p.weeklyFrequency}回
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground leading-relaxed">
              まだ柱がありません。毎日の記録で、あなたを支える柱を育てましょう 🌱
            </p>
          )}
        </div>
      )}

      {/* ポートフォリオミニ */}
      <div className="bg-white rounded-2xl border border-border shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">過去30日</p>
            <p className="font-semibold text-foreground mt-0.5">心のポートフォリオ</p>
          </div>
          <Link href="/portfolio" className="text-xs text-accent font-medium hover:underline flex items-center gap-0.5">
            詳しく
            <Icon name="chevron_right" className="text-base" />
          </Link>
        </div>
        <PortfolioPie breakdown={portfolio?.breakdown ?? []} compact />
        {portfolio?.isBlended && (
          <p className="text-[11px] text-muted-foreground mt-2 text-center">
            はじめの診断を含む表示です。記録を重ねると実データに置き換わります
          </p>
        )}
      </div>

      {/* AIコーチカード */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-700 rounded-2xl p-5 text-white shadow-lg shadow-slate-300">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Icon name="smart_toy" className="text-base opacity-80" />
              <span className="text-xs font-semibold opacity-80 uppercase tracking-wider">AIコーチ</span>
              <span className="text-[10px] bg-accent text-white rounded-full px-2 py-0.5 font-semibold">Pro</span>
            </div>
            <p className="font-semibold mb-0.5">あなた専用のアドバイス</p>
            <p className="text-xs opacity-70">ポートフォリオを分析して、心のバランスを提案します</p>
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
