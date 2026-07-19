import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { View, Text, TextInput, Pressable, Switch, ScrollView } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import DateTimePicker from '@react-native-community/datetimepicker';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { registerForPushNotifications } from '@/lib/push-notifications';
import { toast } from '@/store/toast';
import { Icon } from '@/components/ui/icon';
import type { Category, PresetCategory, Profile } from '@/types';

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
  const [groupDropdownOpen, setGroupDropdownOpen] = useState(false);

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

  function handleCustomCategorySubmit() {
    if (!customName.trim() || !customParentName.trim()) return;
    customCategoryMutation.mutate({
      name: customName.trim(),
      parentName: customParentName.trim(),
      color: customColor,
    });
  }

  const parentNameOptions = Array.from(
    new Set([...categories.map((c) => c.parentName), ...presets.map((p) => p.parentName)]),
  );
  const isPro = profile?.plan === 'pro';

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="px-4 pb-8 pt-6">
      <Text className="mb-6 text-xl font-bold text-foreground">設定</Text>

      <View className="gap-6">
        <View>
          <Text className="mb-3 text-sm font-semibold text-muted-foreground">カテゴリ管理</Text>
          {Object.entries(grouped).map(([group, cats]) => (
            <View key={group} className="mb-4">
              <Text className="mb-2 text-xs text-muted-foreground">{group}</Text>
              <View className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
                {cats.map((cat, i) => (
                  <View
                    key={cat.id}
                    className={`flex-row items-center px-4 py-3 ${i !== 0 ? 'border-t border-border' : ''}`}
                  >
                    <View className="mr-3 h-3 w-3 rounded-full" style={{ backgroundColor: cat.color }} />
                    <Text className="flex-1 text-sm text-foreground">{cat.name}</Text>
                    <Switch
                      value={cat.isActive}
                      onValueChange={(v) => toggleMutation.mutate({ id: cat.id, isActive: v })}
                    />
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>

        {addablePresets.length > 0 && (
          <View>
            <Text className="mb-3 text-sm font-semibold text-muted-foreground">カテゴリを追加</Text>
            <Text className="mb-3 text-xs leading-relaxed text-muted-foreground">
              オンボーディングで選ばなかったカテゴリも、あとから追加できます
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

        <View>
          <Text className="mb-3 text-sm font-semibold text-muted-foreground">カスタムカテゴリを追加</Text>
          {isPro ? (
            <View className="gap-3 rounded-xl border border-border bg-white p-4 shadow-sm">
              <View>
                <Text className="mb-1.5 text-xs text-muted-foreground">カテゴリ名</Text>
                <TextInput
                  value={customName}
                  onChangeText={setCustomName}
                  maxLength={50}
                  placeholder="例: 推し活"
                  className="rounded-lg border border-border px-3 py-2 text-sm text-foreground"
                />
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
                  {customCategoryMutation.isPending ? '追加中...' : 'カテゴリを追加'}
                </Text>
              </Pressable>
            </View>
          ) : (
            <View className="items-center rounded-xl border border-border bg-white p-5 shadow-sm">
              <Text className="mb-1 text-sm font-semibold text-foreground">好きな名前でカテゴリを作れます</Text>
              <Text className="mb-3 text-center text-xs leading-relaxed text-muted-foreground">
                Proプランなら、プリセットにない自分だけのカテゴリを自由に追加できます
              </Text>
              <Pressable
                onPress={() => router.push('/paywall')}
                className="rounded-xl bg-accent px-5 py-2.5"
              >
                <Text className="text-sm font-semibold text-accent-foreground">Proプランを見る</Text>
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
          <Text className="mb-3 text-sm font-semibold text-muted-foreground">表示設定</Text>
          <View className="rounded-xl border border-border bg-white shadow-sm">
            <View className="flex-row items-center px-4 py-3">
              <View className="flex-1">
                <Text className="text-sm text-foreground">育成提案を表示しない</Text>
                <Text className="mt-0.5 text-xs text-muted-foreground">「次に育てる柱」の提案を非表示にします</Text>
              </View>
              <Switch
                value={profile?.suggestionMuted ?? false}
                onValueChange={(v) => suggestionMutation.mutate(v)}
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
