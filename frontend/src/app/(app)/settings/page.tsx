'use client';

import { useState, type FocusEvent, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { toast } from '@/store/toast';
import { Icon } from '@/components/ui/icon';
import type { Category, PresetCategory, Profile } from '@/types';

const CUSTOM_CATEGORY_COLORS = [
  '#E84393',
  '#6C5CE7',
  '#0984E3',
  '#00B894',
  '#FDCB6E',
  '#E17055',
  '#D63031',
  '#B2BEC3',
];

export default function SettingsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [customName, setCustomName] = useState('');
  const [customParentName, setCustomParentName] = useState('');
  const [customColor, setCustomColor] = useState(CUSTOM_CATEGORY_COLORS[0]);
  const [groupDropdownOpen, setGroupDropdownOpen] = useState(false);

  function handleGroupFieldBlur(e: FocusEvent<HTMLDivElement>) {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setGroupDropdownOpen(false);
    }
  }

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => api.get<Category[]>('/categories'),
  });

  const { data: presets = [] } = useQuery<PresetCategory[]>({
    queryKey: ['presets'],
    queryFn: () => api.get<PresetCategory[]>('/categories/presets'),
  });

  const { data: profile } = useQuery<Profile>({
    queryKey: ['profile'],
    queryFn: () => api.get<Profile>('/profile'),
  });

  function errorMessage(error: unknown) {
    return error instanceof Error ? error.message : '通信に失敗しました';
  }

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/categories/${id}`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
    onError: (error) => toast.error(errorMessage(error)),
  });

  const addMutation = useMutation({
    mutationFn: (presetId: string) => api.post<Category[]>('/categories/bulk', { presetIds: [presetId] }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      toast.success('カテゴリを追加しました');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const customCategoryMutation = useMutation({
    mutationFn: (dto: { name: string; parentName: string; color: string }) =>
      api.post<Category>('/categories', dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      toast.success('カテゴリを追加しました');
      setCustomName('');
      setCustomParentName('');
      setCustomColor(CUSTOM_CATEGORY_COLORS[0]);
      setGroupDropdownOpen(false);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const suggestionMutation = useMutation({
    mutationFn: (suggestionMuted: boolean) => api.patch('/profile', { suggestionMuted }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] });
      qc.invalidateQueries({ queryKey: ['portfolio'] });
      toast.success('表示設定を更新しました');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const reminderMutation = useMutation({
    mutationFn: (patch: { reminderTime?: string; emailReminderEnabled?: boolean }) =>
      api.patch('/profile', patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] });
      toast.success('リマインド設定を更新しました');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  function handleCustomCategorySubmit(e: FormEvent) {
    e.preventDefault();
    if (!customName.trim() || !customParentName.trim()) return;
    customCategoryMutation.mutate({
      name: customName.trim(),
      parentName: customParentName.trim(),
      color: customColor,
    });
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  const grouped = categories.reduce<Record<string, Category[]>>((acc, c) => {
    (acc[c.parentName] ??= []).push(c);
    return acc;
  }, {});

  const existingKeys = new Set(categories.map((c) => `${c.name}::${c.parentName}`));
  const addablePresets = presets.filter((p) => !existingKeys.has(`${p.name}::${p.parentName}`));
  const groupedAddable = addablePresets.reduce<Record<string, PresetCategory[]>>((acc, p) => {
    (acc[p.parentName] ??= []).push(p);
    return acc;
  }, {});

  const parentNameOptions = Array.from(
    new Set([...categories.map((c) => c.parentName), ...presets.map((p) => p.parentName)]),
  );
  const isPro = profile?.plan === 'pro';

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

        {/* カテゴリ追加 */}
        {addablePresets.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-gray-500 mb-3">カテゴリを追加</p>
            <p className="text-xs text-gray-400 mb-3 leading-relaxed">
              オンボーディングで選ばなかったカテゴリも、あとから追加できます
            </p>
            {Object.entries(groupedAddable).map(([group, ps]) => (
              <div key={group} className="mb-4">
                <p className="text-xs text-gray-400 mb-2">{group}</p>
                <div className="flex flex-wrap gap-2">
                  {ps.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => addMutation.mutate(preset.id)}
                      disabled={addMutation.isPending}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium border-2 border-border bg-white text-foreground hover:border-primary/30 transition disabled:opacity-50"
                    >
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: preset.color }} />
                      {preset.name}
                      <span className="text-gray-400">+</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* カスタムカテゴリ（Pro限定） */}
        <div>
          <p className="text-sm font-semibold text-gray-500 mb-3">カスタムカテゴリを追加</p>
          {isPro ? (
            <form
              onSubmit={handleCustomCategorySubmit}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3"
            >
              <div>
                <label className="text-xs text-gray-400 mb-1 block">カテゴリ名</label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  maxLength={50}
                  placeholder="例: 推し活"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                />
              </div>
              <div className="relative" onBlur={handleGroupFieldBlur}>
                <label className="text-xs text-gray-400 mb-1 block">グループ名</label>
                <div className="flex items-center rounded-lg border border-gray-200 focus-within:border-primary/40">
                  <input
                    type="text"
                    value={customParentName}
                    onChange={(e) => setCustomParentName(e.target.value)}
                    onFocus={() => setGroupDropdownOpen(true)}
                    maxLength={50}
                    placeholder="例: 趣味（既存から選ぶか、新しく入力）"
                    className="flex-1 px-3 py-2 text-sm outline-none"
                  />
                  {parentNameOptions.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setGroupDropdownOpen((o) => !o)}
                      aria-label="グループ一覧を開く"
                      className="px-2 text-gray-400"
                    >
                      <Icon name="expand_more" className="text-lg" />
                    </button>
                  )}
                </div>
                {groupDropdownOpen && parentNameOptions.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                    {parentNameOptions.map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => {
                          setCustomParentName(name);
                          setGroupDropdownOpen(false);
                        }}
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">色</label>
                <div className="flex flex-wrap gap-2">
                  {CUSTOM_CATEGORY_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setCustomColor(color)}
                      aria-label={color}
                      className={`w-7 h-7 rounded-full transition ${
                        customColor === color ? 'ring-2 ring-offset-2 ring-indigo-500' : ''
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
              <button
                type="submit"
                disabled={customCategoryMutation.isPending || !customName.trim() || !customParentName.trim()}
                className="w-full py-2.5 rounded-lg bg-indigo-500 text-white text-sm font-semibold disabled:opacity-50"
              >
                {customCategoryMutation.isPending ? '追加中...' : 'カテゴリを追加'}
              </button>
            </form>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 text-center">
              <p className="text-sm font-semibold text-foreground mb-1">好きな名前でカテゴリを作れます</p>
              <p className="text-xs text-gray-400 mb-3 leading-relaxed">
                Proプランなら、プリセットにない自分だけのカテゴリを自由に追加できます
              </p>
              <a
                href="/pricing"
                className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-accent text-white text-sm font-semibold rounded-xl hover:bg-[#c94d30] transition shadow-sm shadow-accent/20"
              >
                Proプランを見る
              </a>
            </div>
          )}
        </div>

        {/* リマインド */}
        <div>
          <p className="text-sm font-semibold text-gray-500 mb-3">リマインド</p>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center px-4 py-3">
              <div className="flex-1">
                <p className="text-sm">メールリマインド</p>
                <p className="text-xs text-gray-400 mt-0.5">未記録の日に記録を促すメールを送ります</p>
              </div>
              <button
                onClick={() => reminderMutation.mutate({ emailReminderEnabled: !profile?.emailReminderEnabled })}
                disabled={!profile || reminderMutation.isPending}
                className={`relative w-10 h-5 rounded-full transition ${
                  profile?.emailReminderEnabled ? 'bg-indigo-500' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${
                    profile?.emailReminderEnabled ? 'left-5' : 'left-0.5'
                  }`}
                />
              </button>
            </div>
            <div className="flex items-center px-4 py-3 border-t border-gray-50">
              <div className="flex-1">
                <p className="text-sm">リマインド時刻</p>
                <p className="text-xs text-gray-400 mt-0.5">この時刻までに記録がなければ通知します</p>
              </div>
              <input
                type="time"
                step={1800}
                value={profile?.reminderTime?.slice(0, 5) ?? '21:30'}
                onChange={(e) => e.target.value && reminderMutation.mutate({ reminderTime: e.target.value })}
                disabled={!profile || !profile.emailReminderEnabled}
                className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm disabled:opacity-40"
              />
            </div>
          </div>
        </div>

        {/* 表示設定 */}
        <div>
          <p className="text-sm font-semibold text-gray-500 mb-3">表示設定</p>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="flex items-center px-4 py-3">
              <div className="flex-1">
                <p className="text-sm">育成提案を表示しない</p>
                <p className="text-xs text-gray-400 mt-0.5">「次に育てる柱」の提案を非表示にします</p>
              </div>
              <button
                onClick={() => suggestionMutation.mutate(!profile?.suggestionMuted)}
                disabled={!profile || suggestionMutation.isPending}
                className={`relative w-10 h-5 rounded-full transition ${
                  profile?.suggestionMuted ? 'bg-indigo-500' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${
                    profile?.suggestionMuted ? 'left-5' : 'left-0.5'
                  }`}
                />
              </button>
            </div>
          </div>
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

        {/* サポート・規約 */}
        <div>
          <p className="text-sm font-semibold text-gray-500 mb-3">サポート</p>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {[
              { href: '/support-resources', label: '相談窓口（つらいときは）' },
              { href: '/terms', label: '利用規約' },
              { href: '/privacy', label: 'プライバシーポリシー' },
            ].map(({ href, label }, i) => (
              <a
                key={href}
                href={href}
                target="_blank"
                rel="noreferrer"
                className={`flex items-center justify-between px-4 py-3 text-sm hover:bg-gray-50 transition ${i !== 0 ? 'border-t border-gray-50' : ''}`}
              >
                <span>{label}</span>
                <span className="text-gray-400">→</span>
              </a>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3 leading-relaxed">
            ココロバランスは医療・診断を目的としたアプリではありません。
          </p>
        </div>
      </div>
    </div>
  );
}
