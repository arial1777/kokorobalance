'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import type { Category } from '@/types';

export default function SettingsPage() {
  const router = useRouter();
  const qc = useQueryClient();

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => api.get<Category[]>('/categories'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/categories/${id}`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  const grouped = categories.reduce<Record<string, Category[]>>((acc, c) => {
    (acc[c.parentName] ??= []).push(c);
    return acc;
  }, {});

  return (
    <div className="px-4 pt-6 pb-8">
      <h1 className="text-xl font-bold mb-6">設定</h1>

      <div className="space-y-6">
        {/* カテゴリ管理 */}
        <div>
          <p className="text-sm font-semibold text-gray-500 mb-3">カテゴリ管理</p>
          {Object.entries(grouped).map(([group, cats]) => (
            <div key={group} className="mb-4">
              <p className="text-xs text-gray-400 mb-2">{group}</p>
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
                {cats.map((cat, i) => (
                  <div
                    key={cat.id}
                    className={`flex items-center px-4 py-3 ${i !== 0 ? 'border-t border-gray-50' : ''}`}
                  >
                    <div className="w-3 h-3 rounded-full mr-3" style={{ backgroundColor: cat.color }} />
                    <span className="flex-1 text-sm">{cat.name}</span>
                    <button
                      onClick={() => toggleMutation.mutate({ id: cat.id, isActive: !cat.isActive })}
                      className={`relative w-10 h-5 rounded-full transition ${
                        cat.isActive ? 'bg-indigo-500' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${
                          cat.isActive ? 'left-5' : 'left-0.5'
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* アカウント */}
        <div>
          <p className="text-sm font-semibold text-gray-500 mb-3">アカウント</p>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <button
              onClick={() => router.push('/settings/account')}
              className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-gray-50 transition"
            >
              <span>プロフィール編集</span>
              <span className="text-gray-400">→</span>
            </button>
            <div className="border-t border-gray-50" />
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-between px-4 py-3 text-sm text-red-500 hover:bg-red-50 transition"
            >
              <span>ログアウト</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
