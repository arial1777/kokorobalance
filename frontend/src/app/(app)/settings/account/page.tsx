'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { Icon } from '@/components/ui/icon';
import { AppHeader } from '@/components/layout/app-header';
import type { Profile } from '@/types';

export default function AccountPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [nickname, setNickname] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [exporting, setExporting] = useState(false);

  const { data: profile } = useQuery<Profile>({
    queryKey: ['profile'],
    queryFn: () => api.get<Profile>('/profile'),
  });

  const nicknameMutation = useMutation({
    mutationFn: (value: string) => api.patch('/profile', { nickname: value }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] });
      setNickname(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete('/profile'),
    onSuccess: async () => {
      await supabase.auth.signOut();
      router.push('/');
    },
  });

  async function handleExport() {
    setExporting(true);
    try {
      const data = await api.get<object>('/profile/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kokorobalance-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  const displayNickname = nickname ?? profile?.nickname ?? '';

  return (
    <>
      <AppHeader title="アカウント" subtitle="設定" back />
      <div className="px-4 pt-5 pb-8 space-y-6">
        {/* プロフィール */}
        <div>
          <p className="text-sm font-semibold text-gray-500 mb-3">プロフィール</p>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">ニックネーム</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={displayNickname}
                  onChange={(e) => setNickname(e.target.value)}
                  maxLength={50}
                  className="flex-1 px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary/50"
                />
                <button
                  onClick={() => nickname && nicknameMutation.mutate(nickname)}
                  disabled={!nickname || nickname === profile?.nickname || nicknameMutation.isPending}
                  className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg disabled:opacity-40 transition"
                >
                  保存
                </button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              プラン: <span className="font-semibold">{profile?.plan === 'pro' ? 'Pro' : '無料'}</span>
            </p>
          </div>
        </div>

        {/* データ */}
        <div>
          <p className="text-sm font-semibold text-gray-500 mb-3">データ</p>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <button
              onClick={handleExport}
              disabled={exporting}
              className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-gray-50 transition disabled:opacity-50"
            >
              <span className="flex items-center gap-2">
                <Icon name="download" className="text-lg text-muted-foreground" />
                すべてのデータをエクスポート（JSON）
              </span>
              {exporting && <span className="text-xs text-muted-foreground">作成中…</span>}
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            記録・診断・レポート・AIコーチの会話履歴をダウンロードできます
          </p>
        </div>

        {/* 危険な操作 */}
        <div>
          <p className="text-sm font-semibold text-gray-500 mb-3">アカウントの削除</p>
          <div className="bg-white rounded-xl border border-rose-100 shadow-sm overflow-hidden">
            <button
              onClick={() => setDeleteOpen(true)}
              className="w-full flex items-center gap-2 px-4 py-3 text-sm text-rose-600 hover:bg-rose-50 transition"
            >
              <Icon name="delete_forever" className="text-lg" />
              アカウントとすべてのデータを削除
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            削除すると、記録・レポート・会話履歴を含むすべてのデータが完全に消去され、元に戻せません
          </p>
        </div>
      </div>

      {/* 削除確認モーダル */}
      {deleteOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-6">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
            <div className="w-12 h-12 rounded-xl bg-rose-50 flex items-center justify-center mb-4">
              <Icon name="warning" filled className="text-2xl text-rose-500" />
            </div>
            <h2 className="text-lg font-bold text-foreground mb-2">本当に削除しますか？</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              すべての記録・診断・レポート・会話履歴が完全に削除されます。この操作は取り消せません。
              必要ならエクスポートを先に行ってください。
            </p>
            <p className="text-xs text-muted-foreground mb-2">
              確認のため「<span className="font-bold">削除</span>」と入力してください
            </p>
            <input
              type="text"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="削除"
              className="w-full px-3 py-2.5 rounded-xl border border-border text-sm mb-4 focus:outline-none focus:border-rose-300"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setDeleteOpen(false);
                  setDeleteConfirm('');
                }}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:bg-secondary transition"
              >
                キャンセル
              </button>
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteConfirm !== '削除' || deleteMutation.isPending}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 disabled:opacity-40 transition"
              >
                {deleteMutation.isPending ? '削除中…' : '完全に削除する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
