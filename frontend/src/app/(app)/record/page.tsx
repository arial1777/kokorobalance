'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { track } from '@/lib/analytics';
import { todayJST } from '@/lib/utils';
import { Icon } from '@/components/ui/icon';
import { AppHeader } from '@/components/layout/app-header';
import { SafetyResourceCard } from '@/components/safety-resource-card';
import { KIND_LABEL } from '@/components/pillar-sections';
import type {
  Category,
  CurrentWeeklyCheckResult,
  FluctuationEvent,
  FluctuationMagnitude,
  HotlineView,
  PillarKind,
  SaveFluctuationResult,
  SaveWeeklyCheckResult,
} from '@/types';

type Level = 0 | 1 | 2 | 3;

const VISIBLE_CATEGORY_LIMIT = 10;

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

function formatWeekRange(weekStart: string): string {
  const start = new Date(`${weekStart}T00:00:00Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const fmt = (d: Date) => `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
  return `${fmt(start)} - ${fmt(end)}`;
}

export default function WeeklyCheckPage() {
  const qc = useQueryClient();

  const { data: current, isLoading } = useQuery<CurrentWeeklyCheckResult>({
    queryKey: ['weekly-check-current'],
    queryFn: () => api.get<CurrentWeeklyCheckResult>('/weekly-check/current'),
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => api.get<Category[]>('/categories'),
    select: (cats) => cats.filter((c) => c.isActive),
  });

  const today = todayJST();
  const { data: fluctuations = [] } = useQuery<FluctuationEvent[]>({
    queryKey: ['fluctuations', today],
    queryFn: () => api.get<FluctuationEvent[]>(`/records/fluctuations?from=${today}&to=${today}`),
  });

  const [levels, setLevels] = useState<Record<string, Level>>({});
  const [moodNoteOpen, setMoodNoteOpen] = useState(false);
  const [moodNote, setMoodNote] = useState('');
  const [showMoreCategories, setShowMoreCategories] = useState(false);
  const [result, setResult] = useState<SaveWeeklyCheckResult | null>(null);

  // 点検の画面内から柱を追加する（07 §4.2）
  const [addPillarOpen, setAddPillarOpen] = useState(false);
  const [newPillarName, setNewPillarName] = useState('');
  const [newPillarKind, setNewPillarKind] = useState<PillarKind>('place');

  // 揺らぎ入力フォーム（既存機能。今回のスコープでは変更しない）
  const [fluctOpen, setFluctOpen] = useState(false);
  const [fluctCategoryId, setFluctCategoryId] = useState<string | null>(null);
  const [fluctMagnitude, setFluctMagnitude] = useState<FluctuationMagnitude | null>(null);
  const [fluctNote, setFluctNote] = useState('');
  const [fluctSafetyPrompt, setFluctSafetyPrompt] = useState<{ eventId: string; hotlines: HotlineView[] } | null>(null);

  // 既存の今週の点検を初期表示に反映
  useEffect(() => {
    if (!current) return;
    setLevels((prev) => {
      if (Object.keys(prev).length > 0) return prev;
      const init: Record<string, Level> = {};
      current.entries.forEach((e) => {
        init[e.categoryId] = e.level as Level;
      });
      return init;
    });
    if (current.moodNote) {
      setMoodNote(current.moodNote);
      setMoodNoteOpen(true);
    }
  }, [current]);

  const saveMutation = useMutation({
    mutationFn: () =>
      api.put<SaveWeeklyCheckResult>('/weekly-check', {
        entries: Object.entries(levels)
          .filter(([, level]) => level > 0)
          .map(([categoryId, level]) => ({ categoryId, level })),
        moodNote: moodNote || undefined,
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['weekly-check-current'] });
      qc.invalidateQueries({ queryKey: ['portfolio'] });
      qc.invalidateQueries({ queryKey: ['reports'] });
      track('weekly_check_saved', { entries: res.check.entries.length });
      setResult(res);
    },
  });

  // 点検の画面内から柱を足せるようにする（07 §4.2 / 06 W-04）
  const addPillarMutation = useMutation({
    mutationFn: () =>
      api.post<Category>('/categories', {
        name: newPillarName.trim(),
        parentName: KIND_LABEL[newPillarKind],
        kind: newPillarKind,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      qc.invalidateQueries({ queryKey: ['weekly-check-current'] });
      setNewPillarName('');
      setAddPillarOpen(false);
    },
  });

  const addFluctMutation = useMutation({
    mutationFn: () =>
      api.post<SaveFluctuationResult>('/records/fluctuations', {
        occurredDate: today,
        categoryId: fluctCategoryId ?? undefined,
        magnitude: fluctMagnitude,
        note: fluctNote || undefined,
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['fluctuations', today] });
      setFluctCategoryId(null);
      setFluctMagnitude(null);
      setFluctNote('');
      if (res.safetyVerdict !== 'clear' && res.hotlines.length > 0) {
        setFluctSafetyPrompt({ eventId: res.event.id, hotlines: res.hotlines });
      }
    },
  });

  const deleteFluctMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/records/fluctuations/${id}`),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['fluctuations', today] });
      setFluctSafetyPrompt((prev) => (prev?.eventId === id ? null : prev));
    },
  });

  /** タップの度に 0→1→2→3→0 と巡回する。0(未選択)は保存しない */
  function cycleLevel(id: string) {
    setLevels((prev) => {
      const next = ((prev[id] ?? 0) + 1) % 4 as Level;
      return { ...prev, [id]: next };
    });
  }

  const displayCategories = current?.categories ?? categories.map((c) => ({ ...c, selectionCount: 0 }));
  const visibleCategories = showMoreCategories ? displayCategories : displayCategories.slice(0, VISIBLE_CATEGORY_LIMIT);
  const hiddenCount = displayCategories.length - visibleCategories.length;

  const selectedEntries = Object.entries(levels).filter(([, level]) => level > 0);

  if (result) {
    const topEntry = [...result.check.entries].sort((a, b) => b.level - a.level)[0];
    const topCategory = topEntry ? displayCategories.find((c) => c.id === topEntry.categoryId) : null;
    return (
      <>
        <AppHeader title="今週の点検" subtitle={current ? formatWeekRange(current.weekStart) : ''} back />
        <div className="px-4 pt-8 pb-8">
          <div className="bg-white rounded-2xl border border-border shadow-sm p-6 text-center">
            <p className="text-3xl mb-4">🌙</p>
            <p className="text-base text-foreground leading-relaxed mb-2">
              {topCategory
                ? `今週は${topCategory.name}が大きかったんですね。記録しました。`
                : 'そういう週もあります。記録しました。'}
            </p>
            {/* 確かな柱が0件のまま続いた人にだけ1回（06 §5.2）。宿題に見えないよう控えめに置く */}
            {result.gentleNudge && (
              <p className="mt-4 text-xs text-muted-foreground leading-relaxed text-left">{result.gentleNudge}</p>
            )}
            {result.safetyVerdict !== 'clear' && result.hotlines.length > 0 && (
              <div className="mt-4 text-left">
                <SafetyResourceCard variant="block" hotlines={result.hotlines} />
              </div>
            )}
            <a href="/dashboard" className="inline-block mt-6 text-sm text-accent font-semibold hover:underline">
              ホームへ戻る →
            </a>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <AppHeader title="今週の点検" subtitle={current ? formatWeekRange(current.weekStart) : ''} back />
      <div className="px-4 pt-5 pb-8">
        <p className="text-sm text-muted-foreground mb-1">この1週間、支えになったのは？</p>
        <p className="text-xs text-muted-foreground mb-6">いくつでも、なくても大丈夫です</p>

        {isLoading && <p className="text-center text-sm text-muted-foreground">読み込み中...</p>}

        <div className="space-y-2.5">
          {visibleCategories.map((cat) => {
            const level = levels[cat.id] ?? 0;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => cycleLevel(cat.id)}
                className={`w-full flex items-center gap-3 p-4 rounded-2xl border transition shadow-sm text-left ${
                  level > 0 ? 'border-accent/30 shadow-accent/5' : 'border-border bg-white'
                }`}
                style={level > 0 ? { backgroundColor: `${cat.color}${['', '22', '44', '66'][level]}` } : {}}
              >
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                <span className={`font-medium text-sm flex-1 min-w-0 truncate ${level > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {cat.name}
                </span>
                {'kind' in cat && (
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">{KIND_LABEL[cat.kind]}</span>
                )}
                {level > 0 && (
                  <div className="flex gap-0.5">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`w-1.5 h-4 rounded-full ${i <= level ? 'bg-primary' : 'bg-secondary'}`}
                      />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setShowMoreCategories(true)}
            className="w-full mt-3 py-2 text-xs text-accent font-semibold"
          >
            もっと見る（他{hiddenCount}件）
          </button>
        )}

        {!addPillarOpen ? (
          <button
            type="button"
            onClick={() => setAddPillarOpen(true)}
            className="inline-block mt-4 text-xs text-accent font-semibold"
          >
            ＋ 新しく追加する
          </button>
        ) : (
          <div className="mt-4 bg-white rounded-2xl border border-border shadow-sm p-4 space-y-3">
            <div className="flex gap-1.5">
              {(['place', 'relation', 'habit'] as PillarKind[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setNewPillarKind(k)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition ${
                    newPillarKind === k ? 'bg-primary text-white border-primary' : 'border-border text-muted-foreground'
                  }`}
                >
                  {KIND_LABEL[k]}
                </button>
              ))}
            </div>
            <input
              value={newPillarName}
              onChange={(e) => setNewPillarName(e.target.value)}
              maxLength={20}
              autoFocus
              placeholder={
                newPillarKind === 'relation' ? '名前やあだ名でどうぞ' : newPillarKind === 'place' ? '例: 木曜のバンド' : '例: 朝の散歩'
              }
              className="w-full px-3 py-2.5 rounded-xl border border-border text-sm"
            />
            {newPillarKind === 'relation' && (
              <p className="text-[11px] text-muted-foreground">ここに書いた名前は誰にも見えません。</p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setAddPillarOpen(false);
                  setNewPillarName('');
                }}
                className="flex-1 py-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground"
              >
                やめる
              </button>
              <button
                type="button"
                disabled={!newPillarName.trim() || addPillarMutation.isPending}
                onClick={() => addPillarMutation.mutate()}
                className="flex-1 py-2 rounded-xl bg-accent text-white text-xs font-semibold disabled:opacity-40"
              >
                追加する
              </button>
            </div>
          </div>
        )}

        {/* ひとこと残す（既定で折りたたみ） */}
        <div className="mt-8 bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setMoodNoteOpen((v) => !v)}
            className="w-full flex items-center gap-3 p-4 text-left"
          >
            <Icon name="edit_note" className="text-lg text-muted-foreground" />
            <span className="font-medium text-sm flex-1 text-foreground">
              ひとこと残す<span className="text-xs text-muted-foreground ml-1">（任意）</span>
            </span>
            <Icon name={moodNoteOpen ? 'expand_less' : 'expand_more'} className="text-xl text-muted-foreground" />
          </button>
          {moodNoteOpen && (
            <div className="px-4 pb-4">
              <textarea
                value={moodNote}
                onChange={(e) => setMoodNote(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="今週のことを、少しだけ"
                className="w-full px-3 py-2.5 rounded-xl border border-border text-sm bg-white focus:outline-none focus:border-primary/50 resize-none"
              />
            </div>
          )}
        </div>

        {/* 心が揺れた出来事（任意） */}
        <div className="mt-4 bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
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
            <Icon name={fluctOpen ? 'expand_less' : 'expand_more'} className="text-xl text-muted-foreground" />
          </button>

          {fluctOpen && (
            <div className="px-4 pb-4 space-y-4">
              {fluctuations.length > 0 && (
                <div className="space-y-2">
                  {fluctuations.map((f) => (
                    <div key={f.id} className="flex items-center gap-2 bg-sky-50 border border-sky-100 rounded-xl px-3 py-2">
                      <span className="text-xs font-semibold text-sky-700">{MAGNITUDE_LABEL[f.magnitude]}</span>
                      {f.category && <span className="text-xs text-sky-600">{f.category.name}</span>}
                      {f.note && <span className="text-xs text-muted-foreground flex-1 truncate">{f.note}</span>}
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
                      onClick={() => setFluctCategoryId((prev) => (prev === cat.id ? null : cat.id))}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                        fluctCategoryId === cat.id ? 'text-white border-transparent' : 'border-border bg-white text-muted-foreground'
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
                        fluctMagnitude === value ? 'bg-sky-500 text-white border-sky-500' : 'bg-secondary text-muted-foreground border-transparent'
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

              {fluctSafetyPrompt && (
                <SafetyResourceCard
                  variant="block"
                  hotlines={fluctSafetyPrompt.hotlines}
                  onDelete={() => deleteFluctMutation.mutate(fluctSafetyPrompt.eventId)}
                />
              )}
            </div>
          )}
        </div>

        <div className="mt-8 sticky bottom-6">
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="w-full py-3.5 bg-accent text-white font-semibold rounded-xl hover:bg-[#c94d30] disabled:opacity-50 transition shadow-lg shadow-accent/20 text-sm"
          >
            {saveMutation.isPending ? '記録中…' : selectedEntries.length === 0 ? '今週は思いつかない' : '終わり'}
          </button>
        </div>
      </div>
    </>
  );
}
