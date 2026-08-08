import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { View, Text, TextInput, Pressable, Switch, ScrollView, Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import DateTimePicker from '@react-native-community/datetimepicker';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { registerForPushNotifications } from '@/lib/push-notifications';
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

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://kokorobalance.example.com';

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
  /** 柱のラベルがセーフティ検知に触れたときの窓口（E-07）。依頼は送られていない */
  const [requestSafetyPrompt, setRequestSafetyPrompt] = useState<HotlineView[] | null>(null);

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
      toast.success('お願いしました');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  function confirmVerificationRequest(cat: Category) {
    Alert.alert(
      `${cat.name}`,
      `${pair?.partner?.displayName ?? 'お相手'} さんに、この柱を知ってもらいますか？\n\n相手に見えるのは、この名前だけです。\n（「${cat.name}」）`,
      [
        { text: 'やめる', style: 'cancel' },
        { text: '送る', onPress: () => requestVerificationMutation.mutate(cat.id) },
      ],
    );
  }

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

  const reminderDate = (() => {
    const d = new Date();
    const [h, m] = (profile?.reminderTime ?? '21:30').slice(0, 5).split(':');
    d.setHours(Number(h), Number(m), 0, 0);
    return d;
  })();

  async function handleReminderToggle(enabled: boolean) {
    reminderMutation.mutate({ emailReminderEnabled: enabled });
    if (enabled) {
      // ベストエフォート: 許可されればプッシュ通知に切り替わり、拒否/未対応ならバックエンドがメールにフォールバックする
      registerForPushNotifications().catch(() => {});
    }
  }

  async function handleLogout() {
    await api.delete('/profile/push-token').catch(() => {});
    await supabase.auth.signOut();
    router.replace('/login');
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

  function handleCustomCategorySubmit() {
    if (!customName.trim() || !customParentName.trim()) return;
    customCategoryMutation.mutate({
      name: customName.trim(),
      parentName: customParentName.trim(),
      color: customColor,
      kind: customKind,
    });
  }

  const parentNameOptions = Array.from(
    new Set([...categories.map((c) => c.parentName), ...presets.map((p) => p.parentName)]),
  );

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="px-4 pb-8 pt-6">
      <Text className="mb-6 text-xl font-bold text-foreground">設定</Text>

      <View className="gap-6">
        <View>
          <Text className="mb-1 text-sm font-semibold text-muted-foreground">柱の管理</Text>
          <Text className="mb-3 text-xs leading-relaxed text-muted-foreground">
            型はあとから変えられます。ひとりで楽しんでいたものに仲間ができたら「居場所」に移してください。
          </Text>
          {(['place', 'relation', 'habit'] as PillarKind[]).map((kind) => {
            const cats = groupedByKind[kind] ?? [];
            // 0件のセクションは出さない（07 §3.5 P-03）
            if (cats.length === 0) return null;
            return (
              <View key={kind} className="mb-4">
                <Text className="mb-2 text-xs text-muted-foreground">{KIND_LABEL[kind]}</Text>
                <View className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
                  {cats.map((cat, i) => (
                    <View
                      key={cat.id}
                      className={`flex-row items-center px-4 py-3 ${i !== 0 ? 'border-t border-border' : ''}`}
                    >
                      <View className="mr-3 h-3 w-3 rounded-full" style={{ backgroundColor: cat.color }} />
                      <View className="flex-1">
                        <Text className="text-sm text-foreground" numberOfLines={1}>
                          {cat.name}
                        </Text>
                        {cat.kind !== 'habit' && cat.verifiedAt && (
                          <Text className="text-[10px] text-emerald-600">確かな柱</Text>
                        )}
                        {/* ペアがいるときだけ、育て中の柱に承認を依頼できる（09 §3.1） */}
                        {pair?.state === 'active' && cat.kind !== 'habit' && !cat.verifiedAt && (
                          <Pressable
                            onPress={() => confirmVerificationRequest(cat)}
                            disabled={pair.outgoingRequests.some((r) => r.categoryId === cat.id)}
                          >
                            <Text
                              className={`text-[10px] ${
                                pair.outgoingRequests.some((r) => r.categoryId === cat.id)
                                  ? 'text-muted-foreground'
                                  : 'text-accent'
                              }`}
                            >
                              {pair.outgoingRequests.some((r) => r.categoryId === cat.id)
                                ? 'お願い中'
                                : '承認をお願いする'}
                            </Text>
                          </Pressable>
                        )}
                      </View>
                      <View className="mr-2 flex-row gap-1">
                        {(['place', 'relation', 'habit'] as PillarKind[]).map((k) => (
                          <Pressable
                            key={k}
                            onPress={() => kindMutation.mutate({ id: cat.id, kind: k })}
                            className={`rounded-md px-1.5 py-1 ${cat.kind === k ? 'bg-primary' : 'bg-secondary'}`}
                          >
                            <Text
                              className={`text-[10px] font-semibold ${cat.kind === k ? 'text-white' : 'text-muted-foreground'}`}
                            >
                              {KIND_LABEL[k]}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                      <Switch
                        value={cat.isActive}
                        onValueChange={(v) => toggleMutation.mutate({ id: cat.id, isActive: v })}
                      />
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </View>

        {/* 承認依頼がセーフティ検知で止まったとき。依頼は送られていない（E-07） */}
        {requestSafetyPrompt && (
          <View>
            <SafetyResourceCard variant="block" hotlines={requestSafetyPrompt} />
            <Pressable
              onPress={() => setRequestSafetyPrompt(null)}
              className="mt-3 items-center rounded-xl bg-secondary py-2.5"
            >
              <Text className="text-sm font-semibold text-foreground">閉じる</Text>
            </Pressable>
          </View>
        )}

        {addablePresets.length > 0 && (
          <View>
            <Text className="mb-3 text-sm font-semibold text-muted-foreground">よくある柱から追加</Text>
            <Text className="mb-3 text-xs leading-relaxed text-muted-foreground">
              オンボーディングで選ばなかったものも、あとから追加できます
            </Text>
            {Object.entries(groupedAddable).map(([group, ps]) => (
              <View key={group} className="mb-4">
                <Text className="mb-2 text-xs text-muted-foreground">{group}</Text>
                <View className="flex-row flex-wrap gap-2">
                  {ps.map((preset) => (
                    <Pressable
                      key={preset.id}
                      onPress={() => addMutation.mutate(preset.id)}
                      disabled={addMutation.isPending}
                      className="flex-row items-center gap-1.5 rounded-full border-2 border-border bg-white px-3.5 py-2"
                    >
                      <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: preset.color }} />
                      <Text className="text-sm font-medium text-foreground">{preset.name}</Text>
                      <Text className="text-muted-foreground">+</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* 柱を追加（Free でも使える。自分の言葉で書けることが新しいモデルの根幹 → 07 P-10） */}
        <View>
          <Text className="mb-3 text-sm font-semibold text-muted-foreground">柱を追加</Text>
          {(
            <View className="gap-3 rounded-xl border border-border bg-white p-4 shadow-sm">
              <View>
                <Text className="mb-1.5 text-xs text-muted-foreground">型</Text>
                <View className="flex-row gap-1.5">
                  {(['place', 'relation', 'habit'] as PillarKind[]).map((k) => (
                    <Pressable
                      key={k}
                      onPress={() => setCustomKind(k)}
                      className={`flex-1 items-center rounded-lg border py-1.5 ${
                        customKind === k ? 'border-primary bg-primary' : 'border-border'
                      }`}
                    >
                      <Text
                        className={`text-xs font-semibold ${customKind === k ? 'text-white' : 'text-muted-foreground'}`}
                      >
                        {KIND_LABEL[k]}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View>
                <Text className="mb-1.5 text-xs text-muted-foreground">名前</Text>
                <TextInput
                  value={customName}
                  onChangeText={setCustomName}
                  maxLength={20}
                  placeholder={
                    customKind === 'relation' ? '名前やあだ名でどうぞ' : customKind === 'place' ? '例: 木曜のバンド' : '例: 朝の散歩'
                  }
                  className="rounded-lg border border-border px-3 py-2 text-sm text-foreground"
                />
                {customKind === 'relation' && (
                  <Text className="mt-1 text-[11px] text-muted-foreground">ここに書いた名前は誰にも見えません。</Text>
                )}
              </View>
              <View>
                <Text className="mb-1.5 text-xs text-muted-foreground">グループ名</Text>
                <View className="flex-row items-center rounded-lg border border-border">
                  <TextInput
                    value={customParentName}
                    onChangeText={setCustomParentName}
                    onFocus={() => setGroupDropdownOpen(true)}
                    maxLength={50}
                    placeholder="例: 趣味（既存から選ぶか、新しく入力）"
                    className="flex-1 px-3 py-2 text-sm text-foreground"
                  />
                  {parentNameOptions.length > 0 && (
                    <Pressable onPress={() => setGroupDropdownOpen((o) => !o)} className="px-2">
                      <Icon name="expand_more" size={18} color="#6B5848" />
                    </Pressable>
                  )}
                </View>
                {groupDropdownOpen && parentNameOptions.length > 0 && (
                  <View className="mt-1 max-h-40 overflow-hidden rounded-lg border border-border bg-white shadow-sm">
                    <ScrollView>
                      {parentNameOptions.map((name) => (
                        <Pressable
                          key={name}
                          onPress={() => {
                            setCustomParentName(name);
                            setGroupDropdownOpen(false);
                          }}
                          className="px-3 py-2"
                        >
                          <Text className="text-sm text-foreground">{name}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
              <View>
                <Text className="mb-1.5 text-xs text-muted-foreground">色</Text>
                <View className="flex-row flex-wrap gap-2">
                  {CUSTOM_CATEGORY_COLORS.map((color) => (
                    <Pressable
                      key={color}
                      onPress={() => setCustomColor(color)}
                      className="h-7 w-7 rounded-full"
                      style={{
                        backgroundColor: color,
                        borderWidth: customColor === color ? 2 : 0,
                        borderColor: '#1A3352',
                      }}
                    />
                  ))}
                </View>
              </View>
              <Pressable
                onPress={handleCustomCategorySubmit}
                disabled={customCategoryMutation.isPending || !customName.trim() || !customParentName.trim()}
                className={`rounded-lg bg-primary py-2.5 ${
                  customCategoryMutation.isPending || !customName.trim() || !customParentName.trim()
                    ? 'opacity-40'
                    : ''
                }`}
              >
                <Text className="text-center text-sm font-semibold text-primary-foreground">
                  {customCategoryMutation.isPending ? '追加中...' : '柱を追加'}
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        <View>
          <Text className="mb-3 text-sm font-semibold text-muted-foreground">リマインド</Text>
          <View className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
            <View className="flex-row items-center px-4 py-3">
              <View className="flex-1">
                <Text className="text-sm text-foreground">リマインドを受け取る</Text>
                <Text className="mt-0.5 text-xs text-muted-foreground">
                  未記録の日にお知らせします。プッシュ通知が使える場合は通知で、使えない場合はメールでお知らせします
                </Text>
              </View>
              <Switch
                value={profile?.emailReminderEnabled ?? false}
                onValueChange={handleReminderToggle}
                disabled={!profile}
              />
            </View>
            {profile?.emailReminderEnabled && (
              <View className="flex-row items-center border-t border-border px-4 py-3">
                <View className="flex-1">
                  <Text className="text-sm text-foreground">リマインド時刻</Text>
                  <Text className="mt-0.5 text-xs text-muted-foreground">この時刻までに記録がなければ通知します</Text>
                </View>
                <DateTimePicker
                  value={reminderDate}
                  mode="time"
                  display="compact"
                  minuteInterval={30}
                  onChange={(_event, date) => {
                    if (!date) return;
                    const hh = String(date.getHours()).padStart(2, '0');
                    const mm = String(date.getMinutes()).padStart(2, '0');
                    reminderMutation.mutate({ reminderTime: `${hh}:${mm}` });
                  }}
                />
              </View>
            )}
          </View>
        </View>

        <View>
          <Text className="mb-3 text-sm font-semibold text-muted-foreground">プライバシー</Text>
          <View className="rounded-xl border border-border bg-white shadow-sm">
            <View className="flex-row items-center px-4 py-3">
              <View className="flex-1">
                <Text className="text-sm text-foreground">安全性レビューの対象から外れる</Text>
                <Text className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  クライシス検知の精度確認のための匿名レビュー対象から除外します。リアルタイムの検知自体は継続します
                </Text>
              </View>
              <Switch
                value={profile?.safetyReviewOptOut ?? false}
                onValueChange={(v) => safetyReviewMutation.mutate(v)}
                disabled={!profile}
              />
            </View>
            <View className="border-t border-border" />
            {/* 分析イベントのオプトアウト（11 ME-05）。セーフティの検知は対象外 */}
            <View className="flex-row items-center px-4 py-3">
              <View className="flex-1">
                <Text className="text-sm text-foreground">利用状況の記録を止める</Text>
                <Text className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  どの画面をどう使ったかの記録を止めます。書いた内容はもともと記録していません。つらいときの検知と窓口の案内は、安全のため止まりません
                </Text>
              </View>
              <Switch
                value={profile?.analyticsOptOut ?? false}
                onValueChange={(v) => analyticsMutation.mutate(v)}
                disabled={!profile}
              />
            </View>
          </View>
        </View>

        <View>
          <Text className="mb-3 text-sm font-semibold text-muted-foreground">アカウント</Text>
          <View className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
            <Pressable
              onPress={() => router.push('/settings/account')}
              className="flex-row items-center justify-between px-4 py-3"
            >
              <Text className="text-sm text-foreground">プロフィール編集</Text>
              <Text className="text-muted-foreground">→</Text>
            </Pressable>
            <View className="border-t border-border" />
            <Pressable
              onPress={() => router.push('/settings/pair')}
              className="flex-row items-center justify-between px-4 py-3"
            >
              <Text className="text-sm text-foreground">ペア</Text>
              <Text className="text-muted-foreground">→</Text>
            </Pressable>
            <View className="border-t border-border" />
            <Pressable onPress={handleLogout} className="flex-row items-center justify-between px-4 py-3">
              <Text className="text-sm text-rose-500">ログアウト</Text>
            </Pressable>
          </View>
        </View>

        <View>
          <Text className="mb-3 text-sm font-semibold text-muted-foreground">サポート</Text>
          <View className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
            {[
              { path: '/support-resources', label: '相談窓口（つらいときは）' },
              { path: '/terms', label: '利用規約' },
              { path: '/privacy', label: 'プライバシーポリシー' },
            ].map(({ path, label }, i) => (
              <Pressable
                key={path}
                onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}${path}`)}
                className={`flex-row items-center justify-between px-4 py-3 ${i !== 0 ? 'border-t border-border' : ''}`}
              >
                <Text className="text-sm text-foreground">{label}</Text>
                <Text className="text-muted-foreground">→</Text>
              </Pressable>
            ))}
          </View>
          <Text className="mt-3 text-xs leading-relaxed text-muted-foreground">
            ココロバランスは医療・診断を目的としたアプリではありません。
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
