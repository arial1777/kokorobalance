'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from '@/store/toast';
import { AppHeader } from '@/components/layout/app-header';
import { PairSharingNotice } from '@/components/pair-sharing-notice';
import type { PairView, PillarSlot, VerificationRequestAnswer } from '@/types';

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : '通信に失敗しました';
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/**
 * 確かな柱は色つき、それ以外は白丸。常に5個（09 §2.3、PR-A-12）。
 *
 * 育て中と空きスロットを描き分けないのは意図的。分けると育て中の本数が数えられてしまい、
 * 「数を数えられる形にしない」という §2.3 の狙いが崩れる（仕様のモックも ●●●○○ と同じ丸）
 */
function PillarDots({ slots }: { slots: PillarSlot[] }) {
  return (
    <div className="flex items-center gap-1.5">
      {slots.map((slot, i) =>
        slot.kind === 'verified' ? (
          <span key={i} className="w-3 h-3 rounded-full" style={{ backgroundColor: slot.color }} />
        ) : (
          <span key={i} className="w-3 h-3 rounded-full border-2 border-border bg-white" />
        ),
      )}
    </div>
  );
}

export default function PairPage() {
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const [code, setCode] = useState(searchParams.get('code') ?? '');
  const [copied, setCopied] = useState(false);

  const { data: pair, isLoading } = useQuery<PairView>({
    queryKey: ['pair'],
    queryFn: () => api.get<PairView>('/pair'),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['pair'] });
    qc.invalidateQueries({ queryKey: ['categories'] });
  };

  const inviteMutation = useMutation({
    mutationFn: () => api.post<{ code: string; expiresAt: string }>('/pair/invite'),
    onSuccess: refresh,
    onError: (e) => toast.error(errorMessage(e)),
  });

  const revokeMutation = useMutation({
    mutationFn: () => api.delete('/pair/invite'),
    onSuccess: refresh,
    onError: (e) => toast.error(errorMessage(e)),
  });

  const acceptMutation = useMutation({
    mutationFn: () => api.post('/pair/accept', { code: code.trim().toUpperCase() }),
    onSuccess: () => {
      setCode('');
      refresh();
      toast.success('ペアになりました');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const pauseMutation = useMutation({
    mutationFn: () => api.post('/pair/pause'),
    onSuccess: refresh,
    onError: (e) => toast.error(errorMessage(e)),
  });
  const resumeMutation = useMutation({
    mutationFn: () => api.post('/pair/resume'),
    onSuccess: refresh,
    onError: (e) => toast.error(errorMessage(e)),
  });
  const endMutation = useMutation({
    mutationFn: () => api.delete('/pair'),
    onSuccess: refresh,
    onError: (e) => toast.error(errorMessage(e)),
  });

  const respondMutation = useMutation({
    mutationFn: ({ id, answer }: { id: string; answer: VerificationRequestAnswer }) =>
      api.post(`/pair/requests/${id}/respond`, { answer }),
    onSuccess: refresh,
    onError: (e) => toast.error(errorMessage(e)),
  });

  async function copyCode(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('コピーできませんでした');
    }
  }

  return (
    <>
      <AppHeader title="ペア" subtitle="ひとりだけ、招待できます" back />
      <div className="px-4 pt-5 pb-24 space-y-5">
        {isLoading && <p className="text-center text-sm text-muted-foreground">読み込み中...</p>}

        {/* ペアなし: 招待を作る / コードを入力する */}
        {pair && pair.state === null && (
          <>
            <div className="bg-white rounded-2xl border border-border shadow-sm p-5">
              <p className="text-sm font-semibold text-foreground mb-1">ひとりだけ、招待できます</p>
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                お互いの支えを、そっと確かめ合うためのつながりです。メッセージのやりとりはできません。
              </p>
              <button
                onClick={() => inviteMutation.mutate()}
                disabled={inviteMutation.isPending}
                className="w-full py-3 rounded-xl bg-accent text-white text-sm font-semibold disabled:opacity-40"
              >
                {inviteMutation.isPending ? '作成中…' : '招待コードを作る'}
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-border shadow-sm p-5">
              <p className="text-sm font-semibold text-foreground mb-3">コードをもらった方</p>
              <div className="flex gap-2">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  maxLength={8}
                  placeholder="招待コード"
                  className="flex-1 px-3 py-2.5 rounded-xl border border-border text-sm tracking-widest uppercase"
                />
                <button
                  onClick={() => acceptMutation.mutate()}
                  disabled={code.trim().length < 6 || acceptMutation.isPending}
                  className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-40"
                >
                  つながる
                </button>
              </div>
            </div>

            <PairSharingNotice />
          </>
        )}

        {/* 招待中 */}
        {pair?.state === 'invited' && pair.invite && (
          <>
            <div className="bg-white rounded-2xl border border-border shadow-sm p-5 text-center">
              <p className="text-xs text-muted-foreground mb-2">このコードを、招待したい人に渡してください</p>
              <p className="text-3xl font-bold tracking-widest text-foreground mb-1">{pair.invite.code}</p>
              <p className="text-[11px] text-muted-foreground mb-4">
                {formatDate(pair.invite.expiresAt)}まで有効
              </p>
              <button
                onClick={() => copyCode(pair.invite!.code)}
                className="w-full py-2.5 rounded-xl border border-border text-sm font-semibold text-foreground mb-2"
              >
                {copied ? 'コピーしました' : 'コードをコピー'}
              </button>
              <button
                onClick={() => revokeMutation.mutate()}
                disabled={revokeMutation.isPending}
                className="text-xs text-muted-foreground"
              >
                招待をやめる
              </button>
            </div>
            <PairSharingNotice />
          </>
        )}

        {/* 一時停止中 */}
        {pair?.state === 'paused' && (
          <div className="bg-white rounded-2xl border border-border shadow-sm p-5 text-center">
            <p className="text-sm font-semibold text-foreground mb-1">いま、共有を止めています</p>
            <p className="text-xs text-muted-foreground mb-4">再開するまで、お互いに何も見えません。</p>
            <button
              onClick={() => resumeMutation.mutate()}
              className="w-full py-2.5 rounded-xl bg-accent text-white text-sm font-semibold"
            >
              共有を再開する
            </button>
          </div>
        )}

        {/* 成立後 */}
        {pair?.state === 'active' && pair.partner && (
          <>
            <div className="bg-white rounded-2xl border border-border shadow-sm p-5">
              <p className="text-base font-semibold text-foreground mb-4">{pair.partner.displayName} さん</p>

              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-muted-foreground">今週の点検</span>
                <span className="text-sm text-foreground">
                  {pair.partner.checkedThisWeek ? '済' : 'まだ'}
                </span>
              </div>

              <div className="flex items-center justify-between mb-4">
                <span className="text-xs text-muted-foreground">柱</span>
                <PillarDots slots={pair.partner.pillarSlots} />
              </div>

              {pair.partner.upcomingShake && (
                <div className="rounded-xl bg-sky-50 px-4 py-3">
                  <p className="text-sm text-sky-900">
                    {formatDate(`${pair.partner.upcomingShake.eventDate}T00:00:00`)}に、揺れそうな日があります
                  </p>
                  {pair.partner.upcomingShake.title && (
                    <p className="text-xs text-sky-700 mt-0.5">{pair.partner.upcomingShake.title}</p>
                  )}
                </div>
              )}
            </div>

            {/* 承認してほしいと言われている柱 */}
            {pair.incomingRequests.map((req) => (
              <div key={req.id} className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-5">
                <p className="text-xs text-muted-foreground mb-1">{req.requesterName} さんから</p>
                <p className="text-base font-semibold text-foreground mb-1">「{req.pillarLabel}」</p>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                  これが、{req.requesterName}さんの支えになっていることを知っていますか？
                </p>
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => respondMutation.mutate({ id: req.id, answer: 'known' })}
                    disabled={respondMutation.isPending}
                    className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-40"
                  >
                    知っている
                  </button>
                  <button
                    onClick={() => respondMutation.mutate({ id: req.id, answer: 'unsure' })}
                    disabled={respondMutation.isPending}
                    className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground disabled:opacity-40"
                  >
                    よく知らない
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  どちらを選んでも、相手には「見た」ことだけが伝わります。
                </p>
              </div>
            ))}

            {/* 自分が出している依頼 */}
            {pair.outgoingRequests.length > 0 && (
              <div className="bg-white rounded-2xl border border-border shadow-sm p-5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  お願いしている柱
                </p>
                <div className="space-y-2">
                  {pair.outgoingRequests.map((req) => (
                    <div key={req.id} className="flex items-center justify-between">
                      <span className="text-sm text-foreground">{req.categoryName}</span>
                      <span className="text-xs text-muted-foreground">
                        {req.state === 'seen' ? '見てもらいました' : '待っています'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <PairSharingNotice />

            <div className="pt-2 space-y-3">
              <button
                onClick={() => pauseMutation.mutate()}
                className="w-full text-center text-xs text-muted-foreground"
              >
                しばらく共有を止める
              </button>
              <button
                onClick={() => {
                  if (confirm('ペアを解消しますか？')) endMutation.mutate();
                }}
                className="w-full text-center text-xs text-muted-foreground hover:text-rose-500 transition"
              >
                ペアを解消する
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
