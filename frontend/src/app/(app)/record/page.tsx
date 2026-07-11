'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { track } from '@/lib/analytics';
import { todayJST } from '@/lib/utils';
import { Icon } from '@/components/ui/icon';
import { AppHeader } from '@/components/layout/app-header';
import type {
  Category,
  DailyRecord,
  FluctuationEvent,
  FluctuationMagnitude,
  RecordFeedback,
  SaveRecordResult,
} from '@/types';

type Level = 1 | 2 | 3;

const LEVELS: { value: Level; label: string }[] = [
  { value: 1, label: 'すこし' },
  { value: 2, label: '満たされた' },
  { value: 3, label: 'とても' },
];

const MAGNITUDES: { value: FluctuationMagnitude; label: string }[] = [
  { value: 'small', label: '小' },
  { value: 'medium', label: '中' },
  { value: 'large', label: '大' },
];

const MAGNITUDE_LABEL: Record<FluctuationMagnitude, string> = {
  small: '小さく揺れた',
  medium: '揺れた',
  large: '大きく揺れた',
};

export default function RecordPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const today = todayJST();

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => api.get<Category[]>('/categories'),
    select: (cats) => cats.filter((c) => c.isActive),
  });

  const { data: todayRecord } = useQuery<DailyRecord | null>({
    queryKey: ['record', today],
    queryFn: () => api.get<DailyRecord>(`/records/${today}`),
  });

  const { data: fluctuations = [] } = useQuery<FluctuationEvent[]>({
    queryKey: ['fluctuations', today],
    queryFn: () => api.get<FluctuationEvent[]>(`/records/fluctuations?from=${today}&to=${today}`),
  });

  const [levels, setLevels] = useState<Record<string, Level>>({});
  const [feedback, setFeedback] = useState<RecordFeedback | null>(null);

  // 揺らぎ入力フォーム
  const [fluctOpen, setFluctOpen] = useState(false);
  const [fluctCategoryId, setFluctCategoryId] = useState<string | null>(null);
  const [fluctMagnitude, setFluctMagnitude] = useState<FluctuationMagnitude | null>(null);
  const [fluctNote, setFluctNote] = useState('');

  // 既存の今日の記録を初期表示に反映
  useEffect(() => {
    if (!todayRecord) return;
    setLevels((prev) => {
      if (Object.keys(prev).length > 0) return prev;
      const init: Record<string, Level> = {};
      todayRecord.items.forEach((i) => {
        init[i.categoryId] = Math.min(3, Math.max(1, i.score)) as Level;
      });
      return init;
    });
  }, [todayRecord]);

  const saveMutation = useMutation({
    mutationFn: (items: { categoryId: string; score: number }[]) =>
      api.post<SaveRecordResult>('/records', { recordedDate: today, items }),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['record', today] });
      qc.invalidateQueries({ queryKey: ['portfolio'] });
      track('record_saved', { date: today, items: result.record.items.length });
      setFeedback(result.feedback);
      setTimeout(() => router.push('/dashboard'), 2600);
    },
  });

  const addFluctMutation = useMutation({
    mutationFn: () =>
      api.post<FluctuationEvent>('/records/fluctuations', {
        occurredDate: today,
        categoryId: fluctCategoryId ?? undefined,
        magnitude: fluctMagnitude,
        note: fluctNote || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fluctuations', today] });
      setFluctCategoryId(null);
      setFluctMagnitude(null);
      setFluctNote('');
    },
  });

  const deleteFluctMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/records/fluctuations/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fluctuations', today] }),
  });

  function toggleCategory(id: string) {
    setLevels((prev) => {
      const next = { ...prev };
      if (next[id]) {
        delete next[id];
      } else {
        next[id] = 2; // デフォルトは「満たされた」
      }
      return next;
    });
  }

  function handleSubmit() {
    const items = Object.entries(levels).map(([categoryId, score]) => ({ categoryId, score }));
    saveMutation.mutate(items);
  }

  const selectedCount = Object.keys(levels).length;

  const grouped = categories.reduce<Record<string, Category[]>>((acc, c) => {
    (acc[c.parentName] ??= []).push(c);
    return acc;
  }, {});

  // 保存後のフィードバックオーバーレイ
  if (feedback) {
    return (
      <div className="fixed inset-0 z-50 bg-gradient-to-br from-[#1A3352] to-[#0F1F35] flex items-center justify-center px-8">
        <div className="text-center text-white max-w-sm">
          <p className="text-6xl mb-6">🌱</p>
          <p className="text-2xl font-bold leading-relaxed mb-4">
            今日は{feedback.todaysPillars}本の柱が
            <br />
            あなたを支えました
          </p>
          {feedback.highlights[0] && feedback.highlights[0].weeklyCount > 1 && (
            <p className="text-sm text-white/70">
              「{feedback.highlights[0].categoryName}」は今週{feedback.highlights[0].weeklyCount}回目です
            </p>
          )}
          <p className="text-xs text-white/40 mt-8">ダッシュボードへ移動します…</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <AppHeader title="何で満たされた？" subtitle="今日の記録" back />
      <div className="px-4 pt-5 pb-8">
        <p className="text-sm text-muted-foreground mb-6">
          今日、心が満たされたものをタップしてください
        </p>

        <div className="space-y-7">
          {Object.entries(grouped).map(([group, cats]) => (
            <div key={group}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                {group}
              </p>
              <div className="space-y-2.5">
                {cats.map((cat) => {
                  const level = levels[cat.id];
                  const isSelected = level !== undefined;
                  return (
                    <div
                      key={cat.id}
                      className={`bg-white rounded-2xl border transition shadow-sm overflow-hidden ${
                        isSelected ? 'border-accent/30 shadow-accent/5' : 'border-border'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleCategory(cat.id)}
                        className="w-full flex items-center gap-3 p-4 text-left"
                      >
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span
                          className={`font-medium text-sm flex-1 ${
                            isSelected ? 'text-foreground' : 'text-muted-foreground'
                          }`}
                        >
                          {cat.name}
                        </span>
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition ${
                            isSelected ? 'bg-primary border-primary' : 'border-slate-300'
                          }`}
                        >
                          {isSelected && <Icon name="check" className="text-[13px] text-white" />}
                        </div>
                      </button>

                      {isSelected && (
                        <div className="px-4 pb-4 flex gap-2">
                          {LEVELS.map(({ value, label }) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => setLevels((prev) => ({ ...prev, [cat.id]: value }))}
                              className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition ${
                                level === value
                                  ? 'bg-primary text-white border-primary'
                                  : 'bg-secondary text-muted-foreground border-transparent hover:border-primary/30'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* 心が揺れた出来事（任意・ポートフォリオ集計には入らない） */}
        <div className="mt-8 bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setFluctOpen((v) => !v)}
            className="w-full flex items-center gap-3 p-4 text-left"
          >
            <Icon name="water_drop" className="text-lg text-sky-500" />
            <span className="font-medium text-sm flex-1 text-foreground">
              心が揺れた出来事はありましたか？
              <span className="text-xs text-muted-foreground ml-1">（任意）</span>
            </span>
            <Icon
              name={fluctOpen ? 'expand_less' : 'expand_more'}
              className="text-xl text-muted-foreground"
            />
          </button>

          {fluctOpen && (
            <div className="px-4 pb-4 space-y-4">
              {fluctuations.length > 0 && (
                <div className="space-y-2">
                  {fluctuations.map((f) => (
                    <div
                      key={f.id}
                      className="flex items-center gap-2 bg-sky-50 border border-sky-100 rounded-xl px-3 py-2"
                    >
                      <span className="text-xs font-semibold text-sky-700">
                        {MAGNITUDE_LABEL[f.magnitude]}
                      </span>
                      {f.category && (
                        <span className="text-xs text-sky-600">{f.category.name}</span>
                      )}
                      {f.note && (
                        <span className="text-xs text-muted-foreground flex-1 truncate">
                          {f.note}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => deleteFluctMutation.mutate(f.id)}
                        className="ml-auto text-muted-foreground hover:text-rose-500 transition"
                        aria-label="削除"
                      >
                        <Icon name="close" className="text-base" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <p className="text-xs text-muted-foreground mb-2">関係するもの（任意）</p>
                <div className="flex flex-wrap gap-1.5">
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() =>
                        setFluctCategoryId((prev) => (prev === cat.id ? null : cat.id))
                      }
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                        fluctCategoryId === cat.id
                          ? 'text-white border-transparent'
                          : 'border-border bg-white text-muted-foreground'
                      }`}
                      style={fluctCategoryId === cat.id ? { backgroundColor: cat.color } : {}}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-2">揺れの大きさ</p>
                <div className="flex gap-2">
                  {MAGNITUDES.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFluctMagnitude(value)}
                      className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition ${
                        fluctMagnitude === value
                          ? 'bg-sky-500 text-white border-sky-500'
                          : 'bg-secondary text-muted-foreground border-transparent'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <input
                type="text"
                value={fluctNote}
                onChange={(e) => setFluctNote(e.target.value)}
                placeholder="ひとことメモ（任意）"
                maxLength={500}
                className="w-full px-3 py-2.5 rounded-xl border border-border text-sm bg-white focus:outline-none focus:border-primary/50"
              />

              <button
                type="button"
                onClick={() => addFluctMutation.mutate()}
                disabled={!fluctMagnitude || addFluctMutation.isPending}
                className="w-full py-2.5 rounded-xl bg-sky-500 text-white text-sm font-semibold disabled:opacity-40 hover:bg-sky-600 transition"
              >
                {addFluctMutation.isPending ? '追加中…' : '揺らぎを記録する'}
              </button>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                揺らぎはポートフォリオの割合には入りません。週間レポートで振り返りに使われます。
              </p>
            </div>
          )}
        </div>

        <div className="mt-8 sticky bottom-6">
          <button
            onClick={handleSubmit}
            disabled={selectedCount === 0 || saveMutation.isPending}
            className="w-full py-3.5 bg-accent text-white font-semibold rounded-xl hover:bg-[#c94d30] disabled:opacity-50 transition shadow-lg shadow-accent/20 text-sm"
          >
            {saveMutation.isPending
              ? '保存中…'
              : selectedCount === 0
                ? 'カテゴリをタップしてください'
                : `${selectedCount}件を記録する`}
          </button>
        </div>
      </div>
    </>
  );
}
