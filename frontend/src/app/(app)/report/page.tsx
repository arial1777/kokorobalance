'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { track } from '@/lib/analytics';
import { useAuthStore } from '@/store/auth';
import { Icon } from '@/components/ui/icon';
import { AppHeader } from '@/components/layout/app-header';
import type { FluctuationMagnitude, GenerateReportResult, WeeklyReport } from '@/types';

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
  if (value === 0) return <span className="text-xs text-muted-foreground">±0{suffix}</span>;
  const up = value > 0;
  return (
    <span className={`text-xs font-semibold ${up ? 'text-emerald-600' : 'text-rose-500'}`}>
      {up ? '▲' : '▼'}
      {Math.abs(Math.round(value * 10) / 10)}
      {suffix}
    </span>
  );
}

export default function ReportPage() {
  const { profile } = useAuthStore();
  const qc = useQueryClient();
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const [generateInfo, setGenerateInfo] = useState<string | null>(null);

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
    ? reports.find((r) => r.weekStartDate === selectedWeek) ?? reports[0]
    : reports[0];

  // KPI: レポート閲覧（v2 §10.2）
  useEffect(() => {
    if (report) track('report_viewed', { week: report.weekStartDate });
  }, [report?.id]);
  const previous = report
    ? reports.find((r) => r.weekStartDate === addDays(report.weekStartDate, -7))
    : undefined;

  // カテゴリ内訳と前週比（前週にだけあるカテゴリも含める）
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

  // 無料ユーザー向けテンプレート提案: 前週比で最も減ったカテゴリ
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

  const headerRight = (
    <button
      onClick={() => generateMutation.mutate()}
      disabled={generateMutation.isPending}
      className="flex items-center gap-1 text-xs text-accent font-semibold disabled:opacity-50"
    >
      <Icon name="refresh" className="text-base" />
      {generateMutation.isPending ? '生成中...' : '更新'}
    </button>
  );

  return (
    <>
      <AppHeader title="週間レポート" subtitle="分析" right={headerRight} />
      <div className="px-4 pt-5 pb-8">
        {isLoading && <p className="text-center text-muted-foreground text-sm">読み込み中...</p>}

        {generateInfo && (
          <div className="flex gap-2.5 bg-sky-50 border border-sky-100 rounded-2xl p-4 mb-4">
            <Icon name="info" className="text-lg text-sky-500 flex-shrink-0" />
            <p className="text-xs text-sky-700 leading-relaxed">{generateInfo}</p>
          </div>
        )}

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
            {/* サマリーカード */}
            <div className="bg-white rounded-2xl border border-border shadow-sm p-5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                {formatWeek(report.weekStartDate)}
              </p>
              <div className="flex gap-8">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">充足度</p>
                  <div className="flex items-end gap-2">
                    <p className="text-3xl font-bold text-primary">
                      {report.fulfillmentTotal}
                      <span className="text-sm font-normal text-muted-foreground ml-0.5">pt</span>
                    </p>
                    {previous && (
                      <div className="pb-1">
                        <Delta value={report.fulfillmentTotal - previous.fulfillmentTotal} suffix="pt" />
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">心の柱</p>
                  <p className="text-3xl font-bold text-foreground">
                    {report.pillarCount}
                    <span className="text-sm font-normal text-muted-foreground ml-0.5">本</span>
                  </p>
                </div>
              </div>
            </div>

            {/* カテゴリ内訳（前週比つき） */}
            <div className="bg-white rounded-2xl border border-border shadow-sm p-5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                カテゴリ内訳{previous ? '（前週比）' : ''}
              </p>
              <div className="space-y-3">
                {categoryRows.map(({ name, pct, prev }) => (
                  <div key={name}>
                    <div className="flex justify-between items-center text-sm mb-1">
                      <span className="font-medium text-foreground">{name}</span>
                      <div className="flex items-center gap-2">
                        {prev !== undefined ? (
                          <Delta value={pct - prev} suffix="%" />
                        ) : previous ? (
                          <span className="text-xs font-semibold text-sky-600">NEW</span>
                        ) : null}
                        <span className="font-semibold text-primary w-12 text-right">{pct}%</span>
                      </div>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-[#2A5282] rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 心が揺れた出来事 */}
            {fluctuations && fluctuations.count > 0 && (
              <div className="bg-white rounded-2xl border border-border shadow-sm p-5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  今週、心が揺れた出来事（{fluctuations.count}件）
                </p>
                <div className="space-y-2">
                  {fluctuations.events.map((e, i) => (
                    <div key={i} className="flex items-center gap-2.5 text-sm">
                      <span>💧</span>
                      <span className="text-xs font-semibold text-sky-700 flex-shrink-0">
                        揺れ・{MAGNITUDE_LABEL[e.magnitude]}
                      </span>
                      {e.categoryName && (
                        <span className="text-xs text-muted-foreground flex-shrink-0">{e.categoryName}</span>
                      )}
                      {e.note && <span className="text-xs text-muted-foreground truncate">{e.note}</span>}
                      <span className="text-[11px] text-muted-foreground ml-auto flex-shrink-0">
                        {e.occurredDate.slice(5).replace('-', '/')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AIコメント（Pro）/ テンプレート提案（無料） */}
            {report.aiComment ? (
              <div className="bg-white rounded-2xl border border-border shadow-sm p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon name="smart_toy" filled className="text-base text-primary" />
                  </div>
                  <p className="text-xs font-semibold text-primary">AIコーチからのコメント</p>
                </div>
                <p className="text-sm text-foreground leading-relaxed">{report.aiComment}</p>
              </div>
            ) : profile?.plan !== 'pro' ? (
              <>
                {templateHint && (
                  <div className="flex gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                    <span className="text-base">🌱</span>
                    <div>
                      <p className="text-sm font-semibold text-emerald-800">来週へのヒント</p>
                      <p className="text-xs text-emerald-700 mt-0.5 leading-relaxed">{templateHint}</p>
                    </div>
                  </div>
                )}
                <div className="bg-white rounded-2xl border border-border shadow-sm p-5 text-center">
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-secondary mb-3">
                    <Icon name="lock" filled className="text-xl text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    あなた専用のAIコメントはProプランで読めます
                  </p>
                  <a href="/pricing" className="text-xs text-accent font-semibold hover:underline">
                    アップグレード →
                  </a>
                </div>
              </>
            ) : null}
          </div>
        ) : !isLoading ? (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-secondary mb-4">
              <Icon name="description" className="text-4xl text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground mb-1">まだレポートがありません</p>
            <p className="text-xs text-muted-foreground mb-4">週に2日以上記録するとレポートを作れます</p>
            <button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              className="px-5 py-2.5 bg-accent text-white text-sm font-semibold rounded-xl hover:bg-[#c94d30] disabled:opacity-50 transition shadow-sm shadow-accent/20"
            >
              {generateMutation.isPending ? '生成中...' : '最初のレポートを生成'}
            </button>
          </div>
        ) : null}
      </div>
    </>
  );
}
