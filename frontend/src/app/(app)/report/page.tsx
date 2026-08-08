'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { track } from '@/lib/analytics';
import { useAuthStore } from '@/store/auth';
import { Icon } from '@/components/ui/icon';
import { AppHeader } from '@/components/layout/app-header';
import type { FluctuationMagnitude, WeeklyReport } from '@/types';

const MAGNITUDE_LABEL: Record<FluctuationMagnitude, string> = {
  small: '小',
  medium: '中',
  large: '大',
};

function formatWeek(date: string): string {
  return `${date.slice(5).replace('-', '/')}の週`;
}

export default function WeeklySummaryPage() {
  const { profile } = useAuthStore();
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);

  const { data: reports = [], isLoading } = useQuery<WeeklyReport[]>({
    queryKey: ['reports'],
    queryFn: () => api.get<WeeklyReport[]>('/reports'),
  });

  const report = selectedWeek
    ? reports.find((r) => r.weekStartDate === selectedWeek) ?? reports[0]
    : reports[0];

  // KPI: レポート閲覧（v2 §10.2）
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
    <>
      <AppHeader title="今週のまとめ" subtitle="ふりかえり" />
      <div className="px-4 pt-5 pb-8">
        {isLoading && <p className="text-center text-muted-foreground text-sm">読み込み中...</p>}

        {/* 週の選択 */}
        {reports.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-1 px-1">
            {reports.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedWeek(r.weekStartDate)}
                className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition ${
                  report?.id === r.id
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-muted-foreground border-border'
                }`}
              >
                {formatWeek(r.weekStartDate)}
              </button>
            ))}
          </div>
        )}

        {report ? (
          <div className="space-y-4">
            {/* 支えになったもの */}
            <div className="bg-white rounded-2xl border border-border shadow-sm p-5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                {formatWeek(report.weekStartDate)}・支えになったもの
              </p>
              {categoryRows.length > 0 ? (
                <div className="space-y-3">
                  {categoryRows.map(({ name, pct }) => (
                    <div key={name} className="flex items-center gap-3">
                      <span className="text-sm font-medium text-foreground flex-1">{name}</span>
                      <div className="h-2 bg-secondary rounded-full overflow-hidden w-24">
                        <div
                          className="h-full bg-gradient-to-r from-primary to-[#2A5282] rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground leading-relaxed">そういう週もあります。</p>
              )}
            </div>

            {/* この先の予定 */}
            {fluctuations && fluctuations.count > 0 && (
              <div className="bg-white rounded-2xl border border-border shadow-sm p-5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  心が揺れた出来事（{fluctuations.count}件）
                </p>
                <div className="space-y-2">
                  {fluctuations.events.map((e, i) => (
                    <div key={i} className="flex items-center gap-2.5 text-sm">
                      <span>💧</span>
                      <span className="text-xs font-semibold text-sky-700 flex-shrink-0">
                        揺れ・{MAGNITUDE_LABEL[e.magnitude]}
                      </span>
                      {e.categoryName && <span className="text-xs text-muted-foreground flex-shrink-0">{e.categoryName}</span>}
                      {e.note && <span className="text-xs text-muted-foreground truncate">{e.note}</span>}
                      <span className="text-[11px] text-muted-foreground ml-auto flex-shrink-0">
                        {e.occurredDate.slice(5).replace('-', '/')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AIコメント（Pro） */}
            {report.aiComment ? (
              <div className="bg-white rounded-2xl border border-border shadow-sm p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon name="smart_toy" filled className="text-base text-primary" />
                  </div>
                  <p className="text-xs font-semibold text-primary">今週のひとこと</p>
                </div>
                <p className="text-sm text-foreground leading-relaxed">{report.aiComment}</p>
              </div>
            ) : profile?.plan !== 'pro' ? (
              <div className="bg-white rounded-2xl border border-border shadow-sm p-5 text-center">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-secondary mb-3">
                  <Icon name="lock" filled className="text-xl text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground mb-3">今週のひとこと（AI）はProプランで読めます</p>
                <a href="/pricing" className="text-xs text-accent font-semibold hover:underline">
                  アップグレード →
                </a>
              </div>
            ) : null}
          </div>
        ) : !isLoading ? (
          <div className="text-center py-16">
            <p className="text-sm text-muted-foreground">今週の点検をすると、ここにまとめが表示されます</p>
          </div>
        ) : null}
      </div>
    </>
  );
}
