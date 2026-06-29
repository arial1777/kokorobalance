'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import type { AiCoachMessage } from '@/types';

export default function CoachPage() {
  const { profile } = useAuthStore();
  const qc = useQueryClient();
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading } = useQuery<AiCoachMessage[]>({
    queryKey: ['coach-messages'],
    queryFn: () => api.get<AiCoachMessage[]>('/coach/messages'),
    enabled: profile?.plan === 'pro',
  });

  const mutation = useMutation({
    mutationFn: (message: string) =>
      api.post<{ reply: string; messageId: string }>('/coach/chat', { message }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['coach-messages'] });
      setInput('');
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (profile?.plan !== 'pro') {
    return (
      <div className="px-4 pt-6">
        <h1 className="text-xl font-bold mb-6">AIコーチ</h1>
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-8 text-center">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="text-lg font-bold text-gray-800 mb-2">Proプランで利用できます</h2>
          <p className="text-sm text-gray-500 mb-6">
            あなたの心のポートフォリオデータをもとに、AIが個別アドバイスをお届けします。
          </p>
          <a
            href="/pricing"
            className="inline-block px-6 py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition"
          >
            Proプランを見る
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="px-4 pt-6 pb-3 border-b border-gray-100">
        <h1 className="text-xl font-bold">AIコーチ</h1>
        <p className="text-xs text-gray-400 mt-0.5">心のポートフォリオをもとにアドバイスします</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-32">
        {isLoading && <p className="text-center text-gray-400 text-sm">読み込み中...</p>}
        {messages.length === 0 && !isLoading && (
          <div className="text-center text-gray-400 text-sm mt-8">
            <p className="text-3xl mb-2">🤖</p>
            <p>何でも話しかけてください</p>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs px-4 py-2.5 rounded-2xl text-sm ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-sm'
                  : 'bg-white border border-gray-100 text-gray-800 rounded-bl-sm shadow-sm'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {mutation.isPending && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm text-gray-400 shadow-sm">
              考え中...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="fixed bottom-16 left-0 right-0 max-w-lg mx-auto px-4 pb-3 bg-gray-50">
        <div className="flex gap-2 bg-white border border-gray-200 rounded-2xl p-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (input.trim()) mutation.mutate(input.trim()); } }}
            placeholder="今日の気持ちを話してみて..."
            className="flex-1 text-sm px-2 focus:outline-none bg-transparent"
          />
          <button
            onClick={() => input.trim() && mutation.mutate(input.trim())}
            disabled={!input.trim() || mutation.isPending}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition"
          >
            送信
          </button>
        </div>
      </div>
    </div>
  );
}
