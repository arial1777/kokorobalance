'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Category, DailyRecord } from '@/types';

export default function RecordPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const today = new Date().toISOString().split('T')[0];

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => api.get<Category[]>('/categories'),
    select: (cats) => cats.filter((c) => c.isActive),
  });

  const { data: todayRecord } = useQuery<DailyRecord | null>({
    queryKey: ['record', today],
    queryFn: () => api.get<DailyRecord>(`/records/${today}`),
  });

  const [scores, setScores] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    todayRecord?.items.forEach((i) => { init[i.categoryId] = i.score; });
    return init;
  });
  const [selected, setSelected] = useState<Set<string>>(() =>
    new Set(todayRecord?.items.map((i) => i.categoryId) ?? []),
  );

  const mutation = useMutation({
    mutationFn: (items: { categoryId: string; score: number }[]) =>
      api.post<DailyRecord>('/records', { recordedDate: today, items }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['record', today] });
      qc.invalidateQueries({ queryKey: ['portfolio'] });
      router.push('/dashboard');
    },
  });

  function toggleCategory(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        if (!scores[id]) setScores((s) => ({ ...s, [id]: 50 }));
      }
      return next;
    });
  }

  function handleSubmit() {
    const items = Array.from(selected).map((id) => ({
      categoryId: id,
      score: scores[id] ?? 50,
    }));
    mutation.mutate(items);
  }

  const grouped = categories.reduce<Record<string, Category[]>>((acc, c) => {
    (acc[c.parentName] ??= []).push(c);
    return acc;
  }, {});

  return (
    <div className="px-4 pt-6 pb-8">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-gray-400">←</button>
        <h1 className="text-xl font-bold">今日の記録</h1>
      </div>

      <p className="text-sm text-gray-500 mb-4">今日、心が満たされたものを選んでください</p>

      <div className="space-y-6">
        {Object.entries(grouped).map(([group, cats]) => (
          <div key={group}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{group}</p>
            <div className="space-y-3">
              {cats.map((cat) => (
                <div key={cat.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <label className="flex items-center gap-2 cursor-pointer flex-1">
                      <input
                        type="checkbox"
                        checked={selected.has(cat.id)}
                        onChange={() => toggleCategory(cat.id)}
                        className="w-4 h-4 rounded accent-indigo-600"
                      />
                      <span className="font-medium text-sm">{cat.name}</span>
                    </label>
                    {selected.has(cat.id) && (
                      <span className="text-sm font-bold text-indigo-600 w-8 text-right">
                        {scores[cat.id] ?? 50}
                      </span>
                    )}
                  </div>

                  {selected.has(cat.id) && (
                    <div className="mt-3">
                      <input
                        type="range"
                        min={-100}
                        max={100}
                        value={scores[cat.id] ?? 50}
                        onChange={(e) =>
                          setScores((s) => ({ ...s, [cat.id]: Number(e.target.value) }))
                        }
                        className="w-full accent-indigo-600"
                      />
                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>-100</span>
                        <span className={scores[cat.id] >= 0 ? 'text-green-500' : 'text-red-400'}>
                          {scores[cat.id] >= 0 ? 'プラス' : 'マイナス'}
                        </span>
                        <span>+100</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={handleSubmit}
        disabled={selected.size === 0 || mutation.isPending}
        className="mt-8 w-full py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition"
      >
        {mutation.isPending ? '保存中...' : `${selected.size}件を記録する`}
      </button>
    </div>
  );
}
