'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import type { WeeklyReport } from '@/types';

function getLastMonday(): string {
  const today = new Date();
  const day = today.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  return monday.toISOString().split('T')[0];
}

export default function ReportPage() {
  const { profile } = useAuthStore();
  const thisMonday = getLastMonday();

  const { data: reports = [], isLoading } = useQuery<WeeklyReport[]>({
    queryKey: ['reports'],
    queryFn: () => api.get<WeeklyReport[]>('/reports'),
  });

  const generateMutation = useMutation({
    mutationFn: () => api.post<WeeklyReport>('/reports/generate'),
  });

  const latestReport = reports[0];

  return (
    <div className="px-4 pt-6 pb-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">週間レポート</h1>
        <button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          className="text-xs text-indigo-600 font-medium"
        >
          {generateMutation.isPending ? '生成中...' : '更新'}
        </button>
      </div>

      {isLoading && <p className="text-center text-gray-400 text-sm">読み込み中...</p>}

      {latestReport ? (
        <div className="space-y-4">
          {/* スコアカード */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-400">{latestReport.weekStartDate} 週</p>
            <div className="flex gap-6 mt-2">
              <div>
                <p className="text-xs text-gray-500">合計スコア</p>
                <p className={`text-2xl font-bold ${latestReport.totalScore >= 0 ? 'text-green-500' : 'text-red-400'}`}>
                  {latestReport.totalScore > 0 ? '+' : ''}{latestReport.totalScore}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">分散指数</p>
                <p className="text-2xl font-bold text-indigo-600">{latestReport.diversityScore}点</p>
              </div>
            </div>
          </div>

          {/* カテゴリ内訳 */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <p className="font-medium text-sm mb-3">カテゴリ内訳</p>
            {Object.entries(latestReport.categoryBreakdown)
              .sort(([, a], [, b]) => b - a)
              .map(([name, pct]) => (
                <div key={name} className="mb-2">
                  <div className="flex justify-between text-xs mb-0.5">
                    <span>{name}</span>
                    <span className="font-medium">{pct}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              ))}
          </div>

          {/* AIコメント */}
          {latestReport.aiComment ? (
            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5">
              <p className="text-xs font-medium text-indigo-700 mb-2">🤖 AIコーチからのコメント</p>
              <p className="text-sm text-indigo-800">{latestReport.aiComment}</p>
            </div>
          ) : profile?.plan !== 'pro' ? (
            <div className="bg-gray-50 border border-gray-100 rounded-2xl p-5 text-center">
              <p className="text-sm text-gray-500 mb-2">🔒 AIコメントはProプランで利用できます</p>
              <a href="/pricing" className="text-xs text-indigo-600 font-medium">アップグレード →</a>
            </div>
          ) : null}
        </div>
      ) : !isLoading ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-3xl mb-2">📋</p>
          <p className="text-sm">まだレポートがありません</p>
          <button
            onClick={() => generateMutation.mutate()}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white text-sm rounded-xl"
          >
            最初のレポートを生成
          </button>
        </div>
      ) : null}
    </div>
  );
}
