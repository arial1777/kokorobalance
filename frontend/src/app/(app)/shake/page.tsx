'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { todayJST } from '@/lib/utils';
import { Icon } from '@/components/ui/icon';
import { AppHeader } from '@/components/layout/app-header';
import { SafetyResourceCard } from '@/components/safety-resource-card';
import type { Category, HotlineView, SaveShakeEventResult, ShakeCategory, ShakeEvent, ShakeTemplate } from '@/types';

const CATEGORY_LABELS: Record<ShakeCategory, string> = {
  oshi: '推し',
  work: '仕事',
  relationship: '関係',
  exam: '試験',
  health: '健康',
  money: 'お金',
  life: '人生',
  other: 'その他',
};

const STATUS_LABELS: Record<ShakeEvent['status'], string> = {
  planned: '準備前',
  prepping: '備え中',
  today: '今日',
  passed: 'ふりかえり待ち',
  archived: '完了',
};

const SHAKE_LABELS = ['少し', 'けっこう', 'かなり'];

export default function ShakePage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState<ShakeCategory | null>(null);
  const [template, setTemplate] = useState<ShakeTemplate | null>(null);
  const [customTitle, setCustomTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [isDateCertain, setIsDateCertain] = useState(true);
  const [expectedShake, setExpectedShake] = useState<number | null>(null);
  const [affectedCategoryIds, setAffectedCategoryIds] = useState<string[]>([]);
  const [safetyPrompt, setSafetyPrompt] = useState<{ eventId: string; hotlines: HotlineView[] } | null>(null);

  const { data: events = [], isLoading } = useQuery<ShakeEvent[]>({
    queryKey: ['shake-events'],
    queryFn: () => api.get<ShakeEvent[]>('/shake/events'),
  });

  const { data: templates = [] } = useQuery<ShakeTemplate[]>({
    queryKey: ['shake-templates'],
    queryFn: () => api.get<ShakeTemplate[]>('/shake/templates'),
    enabled: wizardOpen,
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => api.get<Category[]>('/categories'),
    select: (cats) => cats.filter((c) => c.isActive),
    enabled: wizardOpen,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.post<SaveShakeEventResult>('/shake/events', {
        templateKey: template?.templateKey,
        title: template ? undefined : customTitle,
        category: template ? undefined : category,
        eventDate: isDateCertain ? eventDate : todayJST(),
        isDateCertain,
        expectedShake,
        affectedCategoryIds: affectedCategoryIds.length ? affectedCategoryIds : undefined,
      }),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['shake-events'] });
      if (result.safetyVerdict !== 'clear' && result.hotlines.length > 0) {
        setSafetyPrompt({ eventId: result.event.id, hotlines: result.hotlines });
      } else {
        resetWizard();
        router.push(`/shake/${result.event.id}`);
      }
    },
  });

  function resetWizard() {
    setWizardOpen(false);
    setStep(1);
    setCategory(null);
    setTemplate(null);
    setCustomTitle('');
    setEventDate('');
    setIsDateCertain(true);
    setExpectedShake(null);
    setAffectedCategoryIds([]);
  }

  const activeEvents = events.filter((e) => e.status !== 'archived');
  const archivedEvents = events.filter((e) => e.status === 'archived');
  const templatesByCategory = templates.reduce<Record<string, ShakeTemplate[]>>((acc, t) => {
    (acc[t.category] ??= []).push(t);
    return acc;
  }, {});

  function daysUntilLabel(date: string): string {
    const diff = Math.round((new Date(`${date}T00:00:00`).getTime() - new Date(`${todayJST()}T00:00:00`).getTime()) / 86400000);
    if (diff === 0) return '今日';
    if (diff > 0) return `あと${diff}日`;
    return `${-diff}日前`;
  }

  return (
    <>
      <AppHeader title="揺れ予報" subtitle="心が揺れそうな日への備え" />
      <div className="px-4 pt-5 pb-24 space-y-5">
        <button
          type="button"
          onClick={() => setWizardOpen(true)}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-accent text-white font-semibold text-sm shadow-sm shadow-accent/20 hover:bg-[#c94d30] transition"
        >
          <Icon name="add" className="text-lg" />
          揺れそうな日を追加
        </button>

        {isLoading && <p className="text-center text-sm text-muted-foreground">読み込み中...</p>}

        {!isLoading && activeEvents.length === 0 && (
          <div className="text-center text-sm text-muted-foreground mt-8 leading-relaxed">
            <Icon name="thunderstorm" className="text-4xl text-muted-foreground/40 mb-2" />
            <p>いまは穏やかそうです。</p>
            <p>この先、心が揺れそうな日があれば登録してみてください。</p>
          </div>
        )}

        <div className="space-y-2.5">
          {activeEvents.map((e) => (
            <button
              key={e.id}
              onClick={() => router.push(`/shake/${e.id}`)}
              className="w-full text-left bg-white rounded-2xl border border-border shadow-sm p-4 flex items-center gap-3 hover:border-accent/30 transition"
            >
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-foreground truncate">{e.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {e.isDateCertain ? daysUntilLabel(e.eventDate) : '日付未定'} ・ {STATUS_LABELS[e.status]}
                </p>
              </div>
              <Icon name="chevron_right" className="text-lg text-muted-foreground" />
            </button>
          ))}
        </div>

        {archivedEvents.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">完了した揺れ</p>
            <div className="space-y-2">
              {archivedEvents.map((e) => (
                <button
                  key={e.id}
                  onClick={() => router.push(`/shake/${e.id}`)}
                  className="w-full text-left bg-secondary/50 rounded-xl px-4 py-2.5 text-xs text-muted-foreground hover:bg-secondary transition"
                >
                  {e.title}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 登録ウィザード */}
      {wizardOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end md:items-center justify-center">
          <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-xl w-full md:max-w-sm max-h-[85vh] overflow-y-auto p-6">
            {!safetyPrompt ? (
              <>
                {step === 1 && (
                  <div className="space-y-4">
                    <h2 className="text-lg font-bold text-foreground">どんな日？</h2>
                    {!category ? (
                      <div className="grid grid-cols-2 gap-2">
                        {(Object.keys(CATEGORY_LABELS) as ShakeCategory[]).map((c) => (
                          <button
                            key={c}
                            onClick={() => setCategory(c)}
                            className="py-3 rounded-xl border border-border text-sm font-medium hover:border-accent/40 hover:bg-secondary transition"
                          >
                            {CATEGORY_LABELS[c]}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <button onClick={() => setCategory(null)} className="text-xs text-accent">
                          ← カテゴリを選び直す
                        </button>
                        {(templatesByCategory[category] ?? []).map((t) => (
                          <button
                            key={t.id}
                            onClick={() => {
                              setTemplate(t);
                              setExpectedShake(t.defaultExpectedShake);
                              setStep(2);
                            }}
                            className="w-full text-left py-3 px-4 rounded-xl border border-border text-sm font-medium hover:border-accent/40 hover:bg-secondary transition"
                          >
                            {t.templateKey === 'custom' ? 'その他（自分で書く）' : t.label}
                          </button>
                        ))}
                        {category === 'other' && (
                          <div className="pt-2">
                            <input
                              type="text"
                              value={customTitle}
                              onChange={(e) => setCustomTitle(e.target.value)}
                              maxLength={60}
                              placeholder="どんな日か、短く書いてください"
                              className="w-full px-3 py-2.5 rounded-xl border border-border text-sm"
                            />
                            <button
                              disabled={!customTitle.trim()}
                              onClick={() => {
                                setTemplate(null);
                                setExpectedShake(2);
                                setStep(2);
                              }}
                              className="w-full mt-2 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold disabled:opacity-40"
                            >
                              次へ
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-4">
                    <h2 className="text-lg font-bold text-foreground">いつ？</h2>
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={!isDateCertain}
                        onChange={(e) => setIsDateCertain(!e.target.checked)}
                      />
                      まだわからない
                    </label>
                    {isDateCertain && (
                      <input
                        type="date"
                        min={todayJST()}
                        value={eventDate}
                        onChange={(e) => setEventDate(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-border text-sm"
                      />
                    )}
                    <div className="flex gap-2">
                      <button onClick={() => setStep(1)} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground">
                        戻る
                      </button>
                      <button
                        disabled={isDateCertain && !eventDate}
                        onClick={() => setStep(3)}
                        className="flex-1 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold disabled:opacity-40"
                      >
                        次へ
                      </button>
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-4">
                    <h2 className="text-lg font-bold text-foreground">どのくらい揺れそう？</h2>
                    <div className="flex gap-2">
                      {SHAKE_LABELS.map((label, i) => (
                        <button
                          key={label}
                          onClick={() => setExpectedShake(i + 1)}
                          className={`flex-1 py-3 rounded-xl border text-sm font-semibold transition ${
                            expectedShake === i + 1 ? 'bg-primary text-white border-primary' : 'border-border text-muted-foreground'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setStep(2)} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground">
                        戻る
                      </button>
                      <button
                        disabled={!expectedShake}
                        onClick={() => setStep(4)}
                        className="flex-1 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold disabled:opacity-40"
                      >
                        次へ
                      </button>
                    </div>
                  </div>
                )}

                {step === 4 && (
                  <div className="space-y-4">
                    <h2 className="text-lg font-bold text-foreground">揺れるかもしれない柱（任意）</h2>
                    <p className="text-xs text-muted-foreground">選ばなくても大丈夫です</p>
                    <div className="flex flex-wrap gap-1.5">
                      {categories.map((c) => (
                        <button
                          key={c.id}
                          onClick={() =>
                            setAffectedCategoryIds((prev) =>
                              prev.includes(c.id) ? prev.filter((id) => id !== c.id) : [...prev, c.id],
                            )
                          }
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                            affectedCategoryIds.includes(c.id) ? 'text-white border-transparent' : 'border-border bg-white text-muted-foreground'
                          }`}
                          style={affectedCategoryIds.includes(c.id) ? { backgroundColor: c.color } : {}}
                        >
                          {c.name}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setStep(3)} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground">
                        戻る
                      </button>
                      <button
                        disabled={createMutation.isPending}
                        onClick={() => createMutation.mutate()}
                        className="flex-1 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold disabled:opacity-40"
                      >
                        {createMutation.isPending ? '登録中…' : '登録する'}
                      </button>
                    </div>
                  </div>
                )}

                <button onClick={resetWizard} className="w-full text-center text-xs text-muted-foreground mt-4">
                  やめる
                </button>
              </>
            ) : (
              <div className="space-y-4">
                <SafetyResourceCard variant="block" hotlines={safetyPrompt.hotlines} />
                <button
                  onClick={() => {
                    const id = safetyPrompt.eventId;
                    resetWizard();
                    router.push(`/shake/${id}`);
                  }}
                  className="w-full py-2.5 rounded-xl bg-secondary text-sm font-semibold text-foreground"
                >
                  閉じる
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
