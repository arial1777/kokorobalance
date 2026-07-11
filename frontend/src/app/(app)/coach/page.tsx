'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { track } from '@/lib/analytics';
import { Icon } from '@/components/ui/icon';
import { AppHeader } from '@/components/layout/app-header';
import type { AiCoachMessage, ChatResult, CoachQuota, Profile } from '@/types';

export default function CoachPage() {
  const qc = useQueryClient();
  const [input, setInput] = useState('');
  const [consentOpen, setConsentOpen] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: profile } = useQuery<Profile>({
    queryKey: ['profile'],
    queryFn: () => api.get<Profile>('/profile'),
  });

  const { data: quota } = useQuery<CoachQuota>({
    queryKey: ['coach-quota'],
    queryFn: () => api.get<CoachQuota>('/coach/quota'),
  });

  const { data: messages = [], isLoading } = useQuery<AiCoachMessage[]>({
    queryKey: ['coach-messages'],
    queryFn: () => api.get<AiCoachMessage[]>('/coach/messages'),
  });

  const chatMutation = useMutation({
    mutationFn: (message: string) => api.post<ChatResult>('/coach/chat', { message }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['coach-messages'] });
      qc.invalidateQueries({ queryKey: ['coach-quota'] });
      track('coach_chat_sent');
      setInput('');
    },
    onError: (err: Error & { status?: number }, message) => {
      if (err.status === 428) {
        // AI送信への同意が未取得
        setPendingMessage(message);
        setConsentOpen(true);
      }
      if (err.status === 403) track('coach_quota_exhausted');
      qc.invalidateQueries({ queryKey: ['coach-quota'] });
    },
  });

  const consentMutation = useMutation({
    mutationFn: () => api.post('/profile/ai-consent'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] });
      setConsentOpen(false);
      if (pendingMessage) {
        chatMutation.mutate(pendingMessage);
        setPendingMessage(null);
      }
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleSend() {
    const message = input.trim();
    if (!message) return;
    if (profile && !profile.aiConsentAt) {
      setPendingMessage(message);
      setConsentOpen(true);
      return;
    }
    chatMutation.mutate(message);
  }

  const isFree = quota?.plan !== 'pro';
  const exhausted = isFree && quota?.remaining === 0;

  const headerRight = quota ? (
    isFree ? (
      <span className="text-[11px] font-semibold bg-secondary text-muted-foreground rounded-full px-2.5 py-1">
        今月あと{quota.remaining}回
      </span>
    ) : (
      <span className="text-[11px] font-semibold bg-accent/10 text-accent rounded-full px-2.5 py-1">
        Pro
      </span>
    )
  ) : undefined;

  return (
    <>
      <AppHeader title="AIコーチ" subtitle="心のバランス相談" right={headerRight} />

      <div className="px-4 py-4 space-y-4 pb-48 md:pb-36">
        {isLoading && <p className="text-center text-muted-foreground text-sm">読み込み中...</p>}
        {messages.length === 0 && !isLoading && (
          <div className="text-center text-muted-foreground text-sm mt-12">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-3">
              <Icon name="smart_toy" filled className="text-3xl text-primary" />
            </div>
            <p>何でも話しかけてください</p>
            {isFree && quota && (
              <p className="text-xs mt-2">無料プランでは月{quota.limit}回まで話せます</p>
            )}
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs md:max-w-sm px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-primary text-white rounded-br-sm'
                  : msg.isCrisis
                    ? 'bg-sky-50 border border-sky-200 text-foreground rounded-bl-sm shadow-sm'
                    : 'bg-white border border-border text-foreground rounded-bl-sm shadow-sm'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {chatMutation.isPending && (
          <div className="flex justify-start">
            <div className="bg-white border border-border rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm text-muted-foreground shadow-sm">
              考え中...
            </div>
          </div>
        )}

        {/* 無料枠を使い切ったらアップグレード導線 */}
        {exhausted && (
          <div className="bg-white rounded-2xl border border-border shadow-sm p-5 text-center">
            <p className="text-sm font-semibold text-foreground mb-1">今月の無料分を使い切りました</p>
            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
              Proプランなら回数無制限で、週間レポートのAIコメントも読めます
            </p>
            <a
              href="/pricing"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-accent text-white text-sm font-semibold rounded-xl hover:bg-[#c94d30] transition shadow-sm shadow-accent/20"
            >
              Proプランを見る
              <Icon name="chevron_right" className="text-base" />
            </a>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* 入力欄 + 免責フッター */}
      <div className="fixed bottom-[72px] md:bottom-0 left-0 right-0 md:left-56 px-4 pb-3 pt-2 bg-background/95 backdrop-blur-sm border-t border-border z-30">
        <div className="max-w-2xl mx-auto">
          <div className="flex gap-2 bg-white border border-border rounded-2xl p-2 shadow-sm">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={exhausted ? '今月の無料分を使い切りました' : '今日の気持ちを話してみて...'}
              disabled={exhausted}
              className="flex-1 text-sm px-2 focus:outline-none bg-transparent placeholder:text-muted-foreground/50 disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || chatMutation.isPending || exhausted}
              className="px-4 py-2 bg-accent text-white text-sm font-semibold rounded-xl hover:bg-[#c94d30] disabled:opacity-40 transition flex items-center gap-1"
            >
              <Icon name="send" filled className="text-base" />
              送信
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center mt-1.5 leading-relaxed">
            AIコーチは医療行為・診断ではありません。つらいときは{' '}
            <a href="/support-resources" target="_blank" className="text-accent hover:underline">
              相談窓口
            </a>
            （よりそいホットライン 0120-279-338・24時間無料）へ
          </p>
        </div>
      </div>

      {/* AI送信同意モーダル */}
      {consentOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-6">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <Icon name="shield" filled className="text-2xl text-primary" />
            </div>
            <h2 className="text-lg font-bold text-foreground mb-2">AIコーチを始める前に</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              AIコーチとの会話内容と、あなたの心のデータ（ポートフォリオ・柱・揺らぎ）は、応答生成のためにAI（Google Cloud上のClaude）へ送信されます。
            </p>
            <ul className="text-xs text-muted-foreground space-y-1.5 mb-5 leading-relaxed">
              <li>・データが広告や第三者提供に使われることはありません</li>
              <li>・AIコーチは医療行為・診断を行いません</li>
              <li>・同意はいつでも設定から取り消せます</li>
            </ul>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setConsentOpen(false);
                  setPendingMessage(null);
                }}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:bg-secondary transition"
              >
                キャンセル
              </button>
              <button
                onClick={() => consentMutation.mutate()}
                disabled={consentMutation.isPending}
                className="flex-1 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-[#c94d30] disabled:opacity-50 transition"
              >
                {consentMutation.isPending ? '設定中…' : '同意して始める'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
