'use client';

import { useState, type FocusEvent, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { toast } from '@/store/toast';
import { Icon } from '@/components/ui/icon';
import { KIND_LABEL } from '@/components/pillar-sections';
import { SafetyResourceCard } from '@/components/safety-resource-card';
import type {
  Category,
  HotlineView,
  PairView,
  PillarKind,
  PresetCategory,
  Profile,
  RequestVerificationResult,
} from '@/types';

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
  const [customKind, setCustomKind] = useState<PillarKind>('place');
  const [groupDropdownOpen, setGroupDropdownOpen] = useState(false);
  /** 承認を依頼しようとしている柱（警告を出してから送る） */
  const [pendingRequest, setPendingRequest] = useState<Category | null>(null);
  /** 柱のラベルがセーフティ検知に触れたときの窓口（E-07）。依頼は送られていない */
  const [requestSafetyPrompt, setRequestSafetyPrompt] = useState<HotlineView[] | null>(null);

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

  const { data: pair } = useQuery<PairView>({
    queryKey: ['pair'],
    queryFn: () => api.get<PairView>('/pair'),
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
      toast.success('柱を追加しました');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  /** 承認を依頼する（09 §3.1）。送信前に必ずラベルが相手に見えることを警告する（PR-A-04） */
  const requestVerificationMutation = useMutation({
    mutationFn: (categoryId: string) =>
      api.post<RequestVerificationResult>('/pair/requests', { categoryId }),
    onSuccess: (res) => {
      // ラベルがセーフティ検知に触れたときは依頼が送られていない。
      // 成功として扱わず、窓口を出す（E-07）
      if (!res.requested) {
        setRequestSafetyPrompt(res.hotlines);
        return;
      }
      qc.invalidateQueries({ queryKey: ['pair'] });
      setPendingRequest(null);
      toast.success('お願いしました');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  /** 型を変える（例: ひとりで追っていた推しを、現場の知り合いができて「居場所」に上げる → 07 §2.3） */
  const kindMutation = useMutation({
    mutationFn: ({ id, kind }: { id: string; kind: PillarKind }) => api.patch(`/categories/${id}`, { kind }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      qc.invalidateQueries({ queryKey: ['portfolio'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const customCategoryMutation = useMutation({
    mutationFn: (dto: { name: string; parentName: string; color: string; kind: PillarKind }) =>
      api.post<Category>('/categories', dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      toast.success('柱を追加しました');
      setCustomName('');
      setCustomParentName('');
      setCustomColor(CUSTOM_CATEGORY_COLORS[0]);
      setGroupDropdownOpen(false);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const safetyReviewMutation = useMutation({
    mutationFn: (safetyReviewOptOut: boolean) => api.patch('/profile', { safetyReviewOptOut }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] });
      toast.success('プライバシー設定を更新しました');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const analyticsMutation = useMutation({
    mutationFn: (analyticsOptOut: boolean) => api.patch('/profile', { analyticsOptOut }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] });
      toast.success('プライバシー設定を更新しました');
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
      kind: customKind,
    });
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  const groupedByKind = categories.reduce<Partial<Record<PillarKind, Category[]>>>((acc, c) => {
    (acc[c.kind] ??= []).push(c);
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

  return (
    <div className="px-4 pt-6 pb-8">
      <h1 className="text-xl font-bold mb-6">設定</h1>

      <div className="space-y-6">
        {/* 柱の管理 */}
        <div>
          <p className="text-sm font-semibold text-gray-500 mb-1">柱の管理</p>
          <p className="text-xs text-gray-400 mb-3 leading-relaxed">
            型はあとから変えられます。ひとりで楽しんでいたものに仲間ができたら「居場所」に移してください。
          </p>
          {(['place', 'relation', 'habit'] as PillarKind[]).map((kind) => {
            const cats = groupedByKind[kind] ?? [];
            // 0件のセクションは出さない（07 §3.5 P-03）
            if (cats.length === 0) return null;
            return (
              <div key={kind} className="mb-4">
                <p className="text-xs text-gray-400 mb-2">{KIND_LABEL[kind]}</p>
                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
                  {cats.map((cat, i) => (
                    <div
                      key={cat.id}
                      className={`flex items-center gap-2 px-4 py-3 ${i !== 0 ? 'border-t border-gray-50' : ''}`}
                    >
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{cat.name}</p>
                        {cat.kind !== 'habit' && cat.verifiedAt && (
                          <p className="text-[10px] text-emerald-600">確かな柱</p>
                        )}
                        {/* ペアがいるときだけ、育て中の柱に承認を依頼できる（09 §3.1） */}
                        {pair?.state === 'active' && cat.kind !== 'habit' && !cat.verifiedAt && (
                          <button
                            type="button"
                            onClick={() => setPendingRequest(cat)}
                            disabled={pair.outgoingRequests.some((r) => r.categoryId === cat.id)}
                            className="text-[10px] text-accent disabled:text-muted-foreground"
                          >
                            {pair.outgoingRequests.some((r) => r.categoryId === cat.id)
                              ? 'お願い中'
                              : '承認をお願いする'}
                          </button>
                        )}
                      </div>
                      <select
                        value={cat.kind}
                        onChange={(e) => kindMutation.mutate({ id: cat.id, kind: e.target.value as PillarKind })}
                        aria-label={`${cat.name}の型`}
                        className="text-xs text-muted-foreground border border-gray-200 rounded-lg py-1 px-1.5 bg-white"
                      >
                        {(['place', 'relation', 'habit'] as PillarKind[]).map((k) => (
                          <option key={k} value={k}>
                            {KIND_LABEL[k]}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => toggleMutation.mutate({ id: cat.id, isActive: !cat.isActive })}
                        aria-label={`${cat.name}を${cat.isActive ? '隠す' : '表示する'}`}
                        className={`relative w-10 h-5 rounded-full transition flex-shrink-0 ${
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
            );
          })}
        </div>

        {/* カテゴリ追加 */}
        {addablePresets.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-gray-500 mb-3">よくある柱から追加</p>
            <p className="text-xs text-gray-400 mb-3 leading-relaxed">
              オンボーディングで選ばなかったものも、あとから追加できます
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

        {/* 柱を追加（Free でも使える。自分の言葉で書けることが新しいモデルの根幹 → 07 P-10） */}
        <div>
          <p className="text-sm font-semibold text-gray-500 mb-3">柱を追加</p>
          {(
            <form
              onSubmit={handleCustomCategorySubmit}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3"
            >
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">型</label>
                <div className="flex gap-1.5">
                  {(['place', 'relation', 'habit'] as PillarKind[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setCustomKind(k)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition ${
                        customKind === k ? 'bg-primary text-white border-primary' : 'border-gray-200 text-muted-foreground'
                      }`}
                    >
                      {KIND_LABEL[k]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">名前</label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  maxLength={20}
                  placeholder={
                    customKind === 'relation' ? '名前やあだ名でどうぞ' : customKind === 'place' ? '例: 木曜のバンド' : '例: 朝の散歩'
                  }
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                />
                {customKind === 'relation' && (
                  <p className="text-[11px] text-gray-400 mt-1">ここに書いた名前は誰にも見えません。</p>
                )}
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
                {customCategoryMutation.isPending ? '追加中...' : '柱を追加'}
              </button>
            </form>
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

        {/* プライバシー */}
        <div>
          <p className="text-sm font-semibold text-gray-500 mb-3">プライバシー</p>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="flex items-center px-4 py-3">
              <div className="flex-1">
                <p className="text-sm">安全性レビューの対象から外れる</p>
                <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                  クライシス検知の精度確認のための匿名レビュー対象から除外します。
                  リアルタイムの検知自体は継続します
                </p>
              </div>
              <button
                onClick={() => safetyReviewMutation.mutate(!profile?.safetyReviewOptOut)}
                disabled={!profile || safetyReviewMutation.isPending}
                className={`relative w-10 h-5 rounded-full transition ${
                  profile?.safetyReviewOptOut ? 'bg-indigo-500' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${
                    profile?.safetyReviewOptOut ? 'left-5' : 'left-0.5'
                  }`}
                />
              </button>
            </div>
            <div className="border-t border-gray-50" />
            {/* 分析イベントのオプトアウト（11 ME-05）。セーフティの検知は対象外 */}
            <div className="flex items-center px-4 py-3">
              <div className="flex-1">
                <p className="text-sm">利用状況の記録を止める</p>
                <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                  どの画面をどう使ったかの記録を止めます。書いた内容はもともと記録していません。
                  つらいときの検知と窓口の案内は、安全のため止まりません
                </p>
              </div>
              <button
                onClick={() => analyticsMutation.mutate(!profile?.analyticsOptOut)}
                disabled={!profile || analyticsMutation.isPending}
                className={`relative w-10 h-5 rounded-full transition ${
                  profile?.analyticsOptOut ? 'bg-indigo-500' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${
                    profile?.analyticsOptOut ? 'left-5' : 'left-0.5'
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
              onClick={() => router.push('/settings/pair')}
              className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-gray-50 transition"
            >
              <span>ペア</span>
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

      {/* 承認依頼の確認。柱のラベルが相手に見える唯一の例外なので、必ず警告してから送る（09 §3.1、PR-A-04） */}
      {pendingRequest && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-6">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
            {requestSafetyPrompt ? (
              /* 依頼は送られていない。送れなかったことより、まず窓口を出す（E-07） */
              <>
                <SafetyResourceCard variant="block" hotlines={requestSafetyPrompt} />
                <button
                  onClick={() => {
                    setRequestSafetyPrompt(null);
                    setPendingRequest(null);
                  }}
                  className="w-full mt-4 py-2.5 rounded-xl bg-secondary text-sm font-semibold text-foreground"
                >
                  閉じる
                </button>
              </>
            ) : (
              <>
                <p className="text-base font-semibold text-foreground mb-1">{pendingRequest.name}</p>
                <p className="text-xs text-muted-foreground mb-4">育て中</p>
                <p className="text-sm text-foreground leading-relaxed mb-3">
                  {pair?.partner?.displayName ?? 'お相手'} さんに、この柱を知ってもらいますか？
                </p>
                <div className="bg-secondary/60 rounded-xl px-4 py-3 mb-5">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    相手に見えるのは、この名前だけです。
                    <br />
                    <span className="text-foreground font-medium">（「{pendingRequest.name}」）</span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPendingRequest(null)}
                    className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground"
                  >
                    やめる
                  </button>
                  <button
                    onClick={() => requestVerificationMutation.mutate(pendingRequest.id)}
                    disabled={requestVerificationMutation.isPending}
                    className="flex-1 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold disabled:opacity-50"
                  >
                    {requestVerificationMutation.isPending ? '送っています…' : '送る'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
