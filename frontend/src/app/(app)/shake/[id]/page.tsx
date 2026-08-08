'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AppHeader } from '@/components/layout/app-header';
import { SafetyResourceCard } from '@/components/safety-resource-card';
import { KIND_LABEL } from '@/components/pillar-sections';
import { ProUpsell } from '@/components/pro-upsell';
import type { PillarKind, PrepAction, Profile, SaveShakeReviewResult, ShakeEventDetail, WasSupported } from '@/types';

const SHAKE_LABELS = ['少し', 'けっこう', 'かなり'];
const SUPPORTED_OPTIONS: { value: WasSupported; label: string }[] = [
  { value: 'yes', label: 'あった' },
  { value: 'partly', label: '少し' },
  { value: 'no', label: 'なかった' },
];

export default function ShakeEventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [customPrepOpen, setCustomPrepOpen] = useState(false);
  const [customPrepBody, setCustomPrepBody] = useState('');
  const [feltShake, setFeltShake] = useState<number | null>(null);
  const [wasSupported, setWasSupported] = useState<WasSupported | null>(null);
  const [helpedIds, setHelpedIds] = useState<string[]>([]);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewResult, setReviewResult] = useState<SaveShakeReviewResult | null>(null);

  // 備えの完了から柱を登録する導線（07 §4.2）
  const [pillarPrompt, setPillarPrompt] = useState<string | null>(null);
  const [newPillarName, setNewPillarName] = useState('');
  const [newPillarKind, setNewPillarKind] = useState<PillarKind>('relation');

  const { data, isLoading } = useQuery<ShakeEventDetail>({
    queryKey: ['shake-event', id],
    queryFn: () => api.get<ShakeEventDetail>(`/shake/events/${id}`),
  });

  const { data: profile } = useQuery<Profile>({
    queryKey: ['profile'],
    queryFn: () => api.get<Profile>('/profile'),
  });

  const acceptMutation = useMutation({
    mutationFn: (prepId: string) => api.post(`/shake/events/${id}/preps/${prepId}/accept`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shake-event', id] }),
  });
  const doneMutation = useMutation({
    mutationFn: (prepId: string) => api.post(`/shake/events/${id}/preps/${prepId}/done`),
    onSuccess: (_data, prepId) => {
      qc.invalidateQueries({ queryKey: ['shake-event', id] });
      // 備えを実行した結果として柱が増えるのが理想的なループ（07 §4.2）
      const done = data?.preps.find((p) => p.id === prepId);
      if (done) setPillarPrompt(done.body);
    },
  });

  // 備えの完了から柱を登録する
  const addPillarMutation = useMutation({
    mutationFn: () =>
      api.post('/categories', {
        name: newPillarName.trim(),
        parentName: KIND_LABEL[newPillarKind],
        kind: newPillarKind,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      qc.invalidateQueries({ queryKey: ['portfolio'] });
      setPillarPrompt(null);
      setNewPillarName('');
    },
  });
  const skipMutation = useMutation({
    mutationFn: (prepId: string) => api.post(`/shake/events/${id}/preps/${prepId}/skip`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shake-event', id] }),
  });
  const customPrepMutation = useMutation({
    mutationFn: () => api.post(`/shake/events/${id}/preps`, { body: customPrepBody }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shake-event', id] });
      setCustomPrepOpen(false);
      setCustomPrepBody('');
    },
  });
  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/shake/events/${id}`),
    onSuccess: () => router.push('/shake'),
  });
  const reviewMutation = useMutation({
    mutationFn: () =>
      api.post<SaveShakeReviewResult>(`/shake/events/${id}/review`, {
        feltShake,
        wasSupported,
        helpedCategoryIds: helpedIds.length ? helpedIds : undefined,
        note: reviewNote || undefined,
      }),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['shake-event', id] });
      setReviewResult(result);
    },
  });

  if (isLoading || !data) {
    return (
      <>
        <AppHeader title="揺れそうな日" back />
        <p className="text-center text-sm text-muted-foreground mt-8">読み込み中...</p>
      </>
    );
  }

  const { event, preps, review } = data;
  const accepted = preps.find((p) => p.state === 'accepted');
  const suggested = preps.filter((p) => p.state === 'suggested');

  return (
    <>
      <AppHeader title={event.title} subtitle="揺れそうな日" back />
      <div className="px-4 pt-5 pb-24 space-y-5">
        {/* 備えを実行した結果として柱が増えるのが理想的なループ（07 §4.2） */}
        {pillarPrompt && (
          <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-5">
            <p className="text-sm font-semibold text-foreground mb-1">できましたね。</p>
            <p className="text-xs text-muted-foreground leading-relaxed mb-3">
              「{pillarPrompt}」で関わった人や場所を、柱として登録しておきますか？
            </p>
            <div className="flex gap-1.5 mb-2.5">
              {(['relation', 'place', 'habit'] as PillarKind[]).map((k) => (
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
              placeholder={newPillarKind === 'relation' ? '名前やあだ名でどうぞ' : '例: 木曜のバンド'}
              className="w-full px-3 py-2.5 rounded-xl border border-border text-sm mb-2"
            />
            {newPillarKind === 'relation' && (
              <p className="text-[11px] text-muted-foreground mb-2">ここに書いた名前は誰にも見えません。</p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setPillarPrompt(null);
                  setNewPillarName('');
                }}
                className="flex-1 py-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground"
              >
                いまはしない
              </button>
              <button
                type="button"
                disabled={!newPillarName.trim() || addPillarMutation.isPending}
                onClick={() => addPillarMutation.mutate()}
                className="flex-1 py-2 rounded-xl bg-accent text-white text-xs font-semibold disabled:opacity-40"
              >
                柱にする
              </button>
            </div>
          </div>
        )}

        {event.preReflection && (event.status === 'prepping' || event.status === 'today') && (
          <div className="bg-white rounded-2xl border border-border shadow-sm p-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">揺れの前の整理</p>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{event.preReflection}</p>
          </div>
        )}

        {event.status === 'planned' && (
          <div className="bg-white rounded-2xl border border-border shadow-sm p-5 text-sm text-muted-foreground leading-relaxed">
            まだ備えの時期ではありません。近づいたら、こちらで備えを一緒に考えます。
          </div>
        )}

        {event.status === 'prepping' && (
          <div className="bg-white rounded-2xl border border-border shadow-sm p-5">
            {accepted ? (
              <>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">いま備えていること</p>
                <div className="bg-secondary rounded-xl p-4">
                  <p className="text-sm text-foreground mb-3">{accepted.body}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => doneMutation.mutate(accepted.id)}
                      className="flex-1 py-2 rounded-lg bg-primary text-white text-xs font-semibold"
                    >
                      できた
                    </button>
                    <button
                      onClick={() => skipMutation.mutate(accepted.id)}
                      className="flex-1 py-2 rounded-lg border border-border text-xs font-semibold text-muted-foreground"
                    >
                      変える
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  ひとつだけ、備えてみませんか
                </p>
                <div className="space-y-2">
                  {suggested.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => acceptMutation.mutate(p.id)}
                      className="w-full text-left px-4 py-3 rounded-xl border border-border text-sm hover:border-accent/40 hover:bg-secondary transition"
                    >
                      {p.body}
                    </button>
                  ))}
                  {!customPrepOpen ? (
                    <button onClick={() => setCustomPrepOpen(true)} className="text-xs text-accent">
                      ＋ 自分で書く
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        value={customPrepBody}
                        onChange={(e) => setCustomPrepBody(e.target.value)}
                        maxLength={60}
                        placeholder="自分で備えを書く"
                        className="flex-1 px-3 py-2 rounded-xl border border-border text-sm"
                      />
                      <button
                        disabled={!customPrepBody.trim() || customPrepMutation.isPending}
                        onClick={() => customPrepMutation.mutate()}
                        className="px-4 py-2 rounded-xl bg-accent text-white text-xs font-semibold disabled:opacity-40"
                      >
                        追加
                      </button>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-3">選ばなくても大丈夫です</p>
              </>
            )}
          </div>
        )}

        {event.status === 'today' && event.supportListSnapshot && (
          <div className="bg-white rounded-2xl border border-sky-100 shadow-sm p-5">
            <p className="text-sm font-semibold text-foreground mb-4">
              {event.supportListSnapshot.headline === 'many' && 'あなたには、これがあります。'}
              {event.supportListSnapshot.headline === 'one' && '今日は、これがあります。'}
              {event.supportListSnapshot.headline === 'none' &&
                '今日はしんどい日かもしれません。無理に何かしなくて大丈夫です。'}
            </p>
            <div className="space-y-2">
              {event.supportListSnapshot.items.map((item, i) => (
                <div key={i} className="rounded-xl bg-secondary px-4 py-3">
                  <p className="text-sm text-foreground">{item.label}</p>
                  {item.detail && <p className="text-xs text-muted-foreground mt-0.5">{item.detail}</p>}
                </div>
              ))}
            </div>
            <div className="mt-4">
              <SafetyResourceCard variant="block" hotlines={data.hotlines} />
            </div>
          </div>
        )}

        {event.status === 'passed' && !review && !reviewResult && (
          <div className="bg-white rounded-2xl border border-border shadow-sm p-5 space-y-5">
            <p className="text-sm font-semibold text-foreground">{event.title} から少し経ちました。どうでしたか？</p>

            <div>
              <p className="text-xs text-muted-foreground mb-2">実際、どのくらい揺れましたか？</p>
              <div className="flex gap-2">
                {SHAKE_LABELS.map((label, i) => (
                  <button
                    key={label}
                    onClick={() => setFeltShake(i + 1)}
                    className={`flex-1 py-2 rounded-xl border text-xs font-semibold ${
                      feltShake === i + 1 ? 'bg-primary text-white border-primary' : 'border-border text-muted-foreground'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-2">支えられた感じはありましたか？</p>
              <div className="flex gap-2">
                {SUPPORTED_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    onClick={() => setWasSupported(o.value)}
                    className={`flex-1 py-2 rounded-xl border text-xs font-semibold ${
                      wasSupported === o.value ? 'bg-primary text-white border-primary' : 'border-border text-muted-foreground'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {preps.some((p) => p.state === 'done') && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">どれが効きましたか？（複数選択・任意）</p>
                <div className="space-y-1.5">
                  {preps
                    .filter((p) => p.state === 'done')
                    .map((p: PrepAction) => (
                      <label key={p.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={p.categoryId ? helpedIds.includes(p.categoryId) : false}
                          disabled={!p.categoryId}
                          onChange={() =>
                            p.categoryId &&
                            setHelpedIds((prev) =>
                              prev.includes(p.categoryId!) ? prev.filter((x) => x !== p.categoryId) : [...prev, p.categoryId!],
                            )
                          }
                        />
                        {p.body}
                      </label>
                    ))}
                </div>
              </div>
            )}

            <input
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              maxLength={500}
              placeholder="ひとこと残す（任意）"
              className="w-full px-3 py-2.5 rounded-xl border border-border text-sm"
            />

            <button
              disabled={!feltShake || !wasSupported || reviewMutation.isPending}
              onClick={() => reviewMutation.mutate()}
              className="w-full py-2.5 rounded-xl bg-accent text-white text-sm font-semibold disabled:opacity-40"
            >
              終わり
            </button>
          </div>
        )}

        {reviewResult && (
          <div className="bg-white rounded-2xl border border-border shadow-sm p-5 space-y-4">
            <p className="text-sm text-foreground leading-relaxed">
              {reviewResult.review.wasSupported === 'no'
                ? 'そうでしたか。書いてくれてありがとうございます。効かなかったことも、次の手がかりになります。'
                : '記録しました。次に揺れそうな日が来たら、まずこれを思い出します。'}
            </p>
            {reviewResult.review.aiReflection && (
              <div className="rounded-xl bg-secondary/60 px-4 py-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">ふりかえり</p>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{reviewResult.review.aiReflection}</p>
              </div>
            )}
            {reviewResult.hotlines.length > 0 && <SafetyResourceCard variant="caution" hotlines={reviewResult.hotlines} />}
          </div>
        )}

        {/*
          課金訴求は「支えられた」と答えた直後にだけ出す（10 §2.4 #1、最重要の訴求点）。
          ふりかえりは passed（D+1以降）でしか行えないので、**揺れの当日には出ない**（M-A-04）。
          つらかった人（no / partly）には出さない。
        */}
        {reviewResult?.review.wasSupported === 'yes' && profile?.plan !== 'pro' && (
          <ProUpsell
            route="shake_review_supported"
            headline="よかったです。"
            body="次の揺れる日には、これまでのふりかえりを踏まえた整理を、3日前にお届けすることもできます。"
          />
        )}

        {(event.status === 'archived' || (event.status === 'passed' && (review || reviewResult))) && (
          <div className="bg-secondary/50 rounded-2xl p-5 text-sm text-muted-foreground">
            {review ? (
              <p>
                ふりかえり: 支えられた感じ「{SUPPORTED_OPTIONS.find((o) => o.value === review.wasSupported)?.label}」
              </p>
            ) : (
              <p>この揺れそうな日は完了しました。</p>
            )}
          </div>
        )}

        {event.status !== 'archived' && (
          <button
            onClick={() => {
              if (confirm('この揺れそうな日を削除しますか？')) deleteMutation.mutate();
            }}
            className="w-full text-center text-xs text-muted-foreground hover:text-rose-500 transition pt-2"
          >
            削除する
          </button>
        )}
      </div>
    </>
  );
}
