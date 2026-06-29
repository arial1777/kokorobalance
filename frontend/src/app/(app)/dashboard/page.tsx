'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api';
import { PortfolioPie } from '@/components/charts/portfolio-pie';
import type { DailyRecord, Portfolio } from '@/types';

export default function DashboardPage() {
  const today = new Date().toISOString().split('T')[0];

  const { data: todayRecord } = useQuery<DailyRecord | null>({
    queryKey: ['record', today],
    queryFn: () => api.get<DailyRecord>(`/records/${today}`),
  });

  const { data: portfolio } = useQuery<Portfolio>({
    queryKey: ['portfolio', 30],
    queryFn: () => api.get<Portfolio>('/portfolio?period=30'),
  });

  const hasRecordedToday = todayRecord && todayRecord.items.length > 0;

  return (
    <div className="px-4 pt-6 space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">ホーム</h1>
        <Link href="/settings" className="text-gray-400 hover:text-gray-600">
          ⚙️
        </Link>
      </div>

      {/* 今日の心の残高 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <p className="text-sm text-gray-500">今日の心の残高</p>
        <p className={`text-4xl font-bold mt-1 ${(todayRecord?.totalScore ?? 0) >= 0 ? 'text-green-500' : 'text-red-400'}`}>
          {(todayRecord?.totalScore ?? 0) > 0 ? '+' : ''}{todayRecord?.totalScore ?? 0}
        </p>
        {!hasRecordedToday && (
          <Link
            href="/record"
            className="mt-3 inline-block w-full text-center py-2.5 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition text-sm"
          >
            ✏️ 今日の記録をする
          </Link>
        )}
        {hasRecordedToday && (
          <p className="mt-2 text-sm text-green-600">✅ 本日の記録済み</p>
        )}
      </div>

      {/* 偏りアラート */}
      {portfolio?.alert.exists && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <p className="text-sm font-medium text-amber-800">⚠️ 偏りアラート</p>
          <p className="text-sm text-amber-700 mt-1">{portfolio.alert.message}</p>
        </div>
      )}

      {/* ポートフォリオミニ */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <p className="font-medium text-sm">心のポートフォリオ（30日）</p>
          <Link href="/portfolio" className="text-xs text-indigo-600">詳しく →</Link>
        </div>
        <PortfolioPie breakdown={portfolio?.breakdown ?? []} compact />
      </div>

      {/* 分散指数スコア */}
      {portfolio && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">分散指数スコア</p>
          <div className="flex items-end gap-2 mt-1">
            <p className="text-3xl font-bold text-indigo-600">{portfolio.diversityScore}</p>
            <p className="text-sm text-gray-400 mb-1">/ 100点</p>
          </div>
          <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all"
              style={{ width: `${portfolio.diversityScore}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-2">記録日数: {portfolio.totalRecordDays}日</p>
        </div>
      )}

      {/* AIコーチカード */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-5 text-white">
        <p className="text-sm font-medium mb-1">🤖 AIコーチ</p>
        <p className="text-xs opacity-80 mb-3">あなたのポートフォリオをもとに個別アドバイス</p>
        <Link
          href="/coach"
          className="inline-block px-4 py-1.5 bg-white text-indigo-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition"
        >
          話しかける →
        </Link>
      </div>
    </div>
  );
}
