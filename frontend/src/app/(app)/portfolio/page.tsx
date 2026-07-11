'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { api } from '@/lib/api';
import { todayJST } from '@/lib/utils';
import { PortfolioPie } from '@/components/charts/portfolio-pie';
import { Icon } from '@/components/ui/icon';
import { AppHeader } from '@/components/layout/app-header';
import type { FluctuationEvent, FluctuationMagnitude, Portfolio } from '@/types';

const PERIODS = [
  { label: '7日', value: 7 },
  { label: '30日', value: 30 },
  { label: '90日', value: 90 },
] as const;

const MAGNITUDE_META: Record<FluctuationMagnitude, { label: string; size: string }> = {
  small: { label: '小', size: 'text-sm' },
  medium: { label: '中', size: 'text-base' },
  large: { label: '大', size: 'text-lg' },
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

  return (
    <>
      <AppHeader title="心のポートフォリオ" subtitle="分析" />
      <div className="px-4 pt-5 pb-8">

      {/* 期間タブ */}
      <div className="flex gap-2 p-1 bg-secondary rounded-xl mb-5">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition ${
              period === p.value
                ? 'bg-white text-primary shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* 育成提案 */}
      {portfolio?.suggestion.exists && (
        <div className="flex gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-4">
          <div className="flex-shrink-0 w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
            <span className="text-base">🌱</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-emerald-800">次に育てる柱</p>
            <p className="text-xs text-emerald-700 mt-0.5 leading-relaxed">{portfolio.suggestion.message}</p>
          </div>
        </div>
      )}

      {/* バランス（相対） */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">バランス（割合）</p>
        <div className="flex gap-1">
          {(['pie', 'bar'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition flex items-center gap-1 ${
                view === v ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon name={v === 'pie' ? 'donut_large' : 'bar_chart'} className="text-base" />
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-border shadow-sm p-5 mb-4">
        {view === 'pie' ? (
          <PortfolioPie breakdown={portfolio?.breakdown ?? []} />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={portfolio?.breakdown ?? []} layout="vertical" margin={{ left: 40, right: 20 }}>
              <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="categoryName" tick={{ fontSize: 12 }} width={60} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => [`${v}%`, '割合']} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} />
              <Bar dataKey="percentage" radius={[0, 6, 6, 0]}>
                {(portfolio?.breakdown ?? []).map((item, i) => (
                  <Cell key={i} fill={item.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
        {portfolio?.isBlended && (
          <p className="text-[11px] text-muted-foreground mt-2 text-center">
            はじめの診断を含む表示です。記録を重ねると実データに置き換わります
          </p>
        )}
      </div>

      {/* カテゴリランキング */}
      {portfolio && portfolio.breakdown.length > 0 && (
        <div className="space-y-2 mb-6">
          {portfolio.breakdown.map((item, i) => (
            <div key={i} className="bg-white rounded-xl border border-border p-3.5 flex items-center gap-3 shadow-sm">
              <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}</span>
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
              <span className="text-sm font-medium flex-1">{item.categoryName}</span>
              <div className="flex items-center gap-2">
                <div className="w-20 h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${item.percentage}%`, backgroundColor: item.color }} />
                </div>
                <span className="text-sm font-bold text-foreground w-10 text-right">{item.percentage}%</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 充足度（絶対量） */}
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">充足度（週ごとの合計）</p>
      <div className="bg-white rounded-2xl border border-border shadow-sm p-5 mb-4">
        {portfolio && portfolio.fulfillment.weeklyTrend.length > 0 ? (
          <>
            <div className="flex items-end gap-2 mb-4">
              <p className="text-4xl font-bold text-primary">{portfolio.fulfillment.total}</p>
              <p className="text-xs text-muted-foreground pb-1.5">ポイント / {period}日間</p>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={portfolio.fulfillment.weeklyTrend}>
                <XAxis
                  dataKey="weekStart"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v: string) => v.slice(5).replace('-', '/')}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={28} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v) => [`${v}pt`, '充足度']}
                  labelFormatter={(v) => `${String(v).slice(5).replace('-', '/')} の週`}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
                />
                <Bar dataKey="total" fill="#1A3352" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">まだ記録がありません</p>
        )}
      </div>

      {/* 心が揺れた出来事 */}
      {fluctuations.length > 0 && (
        <>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">心が揺れた出来事</p>
          <div className="space-y-2">
            {fluctuations.map((f) => (
              <div key={f.id} className="bg-white rounded-xl border border-border p-3.5 flex items-center gap-3 shadow-sm">
                <span className={MAGNITUDE_META[f.magnitude].size}>💧</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-sky-700">
                      揺れ・{MAGNITUDE_META[f.magnitude].label}
                    </span>
                    {f.category && (
                      <span className="text-xs text-muted-foreground">{f.category.name}</span>
                    )}
                  </div>
                  {f.note && <p className="text-xs text-muted-foreground truncate mt-0.5">{f.note}</p>}
                </div>
                <span className="text-[11px] text-muted-foreground flex-shrink-0">
                  {f.occurredDate.slice(5).replace('-', '/')}
                </span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
            揺らぎは割合には入りません。心が動いた出来事のふりかえりに使われます。
          </p>
        </>
      )}
    </div>
    </>
  );
}
