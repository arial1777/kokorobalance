'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { api } from '@/lib/api';
import { PortfolioPie } from '@/components/charts/portfolio-pie';
import type { Portfolio } from '@/types';

const PERIODS = [
  { label: '7日', value: 7 },
  { label: '30日', value: 30 },
  { label: '90日', value: 90 },
] as const;

export default function PortfolioPage() {
  const [period, setPeriod] = useState<7 | 30 | 90>(30);
  const [view, setView] = useState<'pie' | 'bar'>('pie');

  const { data: portfolio } = useQuery<Portfolio>({
    queryKey: ['portfolio', period],
    queryFn: () => api.get<Portfolio>(`/portfolio?period=${period}`),
  });

  return (
    <div className="px-4 pt-6 pb-8">
      <h1 className="text-xl font-bold mb-6">心のポートフォリオ</h1>

      {/* 期間タブ */}
      <div className="flex gap-2 mb-4">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={`flex-1 py-1.5 text-sm rounded-lg font-medium transition ${
              period === p.value
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* 分散スコア */}
      {portfolio && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">分散指数スコア</p>
              <p className="text-3xl font-bold text-indigo-600">{portfolio.diversityScore}<span className="text-sm font-normal text-gray-400">点</span></p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">記録日数</p>
              <p className="text-lg font-bold text-gray-700">{portfolio.totalRecordDays}<span className="text-xs font-normal text-gray-400">日</span></p>
            </div>
          </div>
          <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full"
              style={{ width: `${portfolio.diversityScore}%` }}
            />
          </div>
        </div>
      )}

      {/* 偏りアラート */}
      {portfolio?.alert.exists && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4">
          <p className="text-sm font-medium text-amber-800">⚠️ 偏りアラート</p>
          <p className="text-sm text-amber-700 mt-1">{portfolio.alert.message}</p>
        </div>
      )}

      {/* グラフ切り替え */}
      <div className="flex gap-2 mb-3">
        {(['pie', 'bar'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-3 py-1 text-xs rounded-lg font-medium transition ${
              view === v ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {v === 'pie' ? '🥧 円グラフ' : '📊 バー'}
          </button>
        ))}
      </div>

      {/* グラフ */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        {view === 'pie' ? (
          <PortfolioPie breakdown={portfolio?.breakdown ?? []} />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={portfolio?.breakdown ?? []} layout="vertical" margin={{ left: 40, right: 20 }}>
              <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="categoryName" tick={{ fontSize: 12 }} width={60} />
              <Tooltip formatter={(v) => [`${v}%`, '割合']} />
              <Bar dataKey="percentage" radius={[0, 4, 4, 0]}>
                {(portfolio?.breakdown ?? []).map((item, i) => (
                  <Cell key={i} fill={item.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* カテゴリ一覧 */}
      {portfolio && portfolio.breakdown.length > 0 && (
        <div className="mt-4 space-y-2">
          {portfolio.breakdown.map((item, i) => (
            <div key={i} className="bg-white rounded-xl p-3 border border-gray-100 flex items-center gap-3">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
              <span className="text-sm font-medium flex-1">{item.categoryName}</span>
              <span className="text-sm font-bold text-gray-700">{item.percentage}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
