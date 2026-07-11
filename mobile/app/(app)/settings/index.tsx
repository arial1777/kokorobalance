import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { View, Text, Pressable, Switch, ScrollView } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import DateTimePicker from '@react-native-community/datetimepicker';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { registerForPushNotifications } from '@/lib/push-notifications';
import type { Category, PresetCategory, Profile } from '@/types';

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://kokorobalance.example.com';

export default function SettingsPage() {
  const router = useRouter();
  const qc = useQueryClient();

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

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/categories/${id}`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });

  const addMutation = useMutation({
    mutationFn: (presetId: string) => api.post<Category[]>('/categories/bulk', { presetIds: [presetId] }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });

  const suggestionMutation = useMutation({
    mutationFn: (suggestionMuted: boolean) => api.patch('/profile', { suggestionMuted }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] });
      qc.invalidateQueries({ queryKey: ['portfolio'] });
    },
  });

  const reminderMutation = useMutation({
    mutationFn: (patch: { reminderTime?: string; emailReminderEnabled?: boolean }) =>
      api.patch('/profile', patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] }),
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
