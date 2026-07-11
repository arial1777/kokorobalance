import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { Icon } from '@/components/ui/icon';
import { AppHeader } from '@/components/ui/app-header';
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
      router.replace('/login');
    },
  });

  async function handleExport() {
    setExporting(true);
    try {
      const data = await api.get<object>('/profile/export');
      const file = new File(Paths.cache, `kokorobalance-export-${new Date().toISOString().split('T')[0]}.json`);
      if (!file.exists) file.create();
      file.write(JSON.stringify(data, null, 2));
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: 'application/json' });
      }
    } finally {
      setExporting(false);
    }
  }

  const displayNickname = nickname ?? profile?.nickname ?? '';

  return (
    <View className="flex-1 bg-background">
      <AppHeader title="アカウント" subtitle="設定" back />
      <ScrollView contentContainerClassName="gap-6 px-4 pb-8 pt-5">
        <View>
          <Text className="mb-3 text-sm font-semibold text-muted-foreground">プロフィール</Text>
          <View className="gap-3 rounded-xl border border-border bg-white p-4 shadow-sm">
            <View>
              <Text className="mb-1.5 text-xs text-muted-foreground">ニックネーム</Text>
              <View className="flex-row gap-2">
                <TextInput
                  value={displayNickname}
                  onChangeText={setNickname}
                  maxLength={50}
                  className="flex-1 rounded-lg border border-border px-3 py-2 text-sm text-foreground"
                />
                <Pressable
                  onPress={() => nickname && nicknameMutation.mutate(nickname)}
                  disabled={!nickname || nickname === profile?.nickname || nicknameMutation.isPending}
                  className={`rounded-lg bg-primary px-4 py-2 ${
                    !nickname || nickname === profile?.nickname || nicknameMutation.isPending ? 'opacity-40' : ''
                  }`}
                >
                  <Text className="text-sm font-semibold text-white">保存</Text>
                </Pressable>
              </View>
            </View>
            <Text className="text-xs text-muted-foreground">
              プラン: <Text className="font-semibold">{profile?.plan === 'pro' ? 'Pro' : '無料'}</Text>
            </Text>
          </View>
        </View>

        <View>
          <Text className="mb-3 text-sm font-semibold text-muted-foreground">データ</Text>
          <View className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
            <Pressable
              onPress={handleExport}
              disabled={exporting}
              className="flex-row items-center justify-between px-4 py-3"
            >
              <View className="flex-row items-center gap-2">
                <Icon name="download" size={18} color="#6B5848" />
                <Text className="text-sm text-foreground">すべてのデータをエクスポート（JSON）</Text>
              </View>
              {exporting && <Text className="text-xs text-muted-foreground">作成中…</Text>}
            </Pressable>
          </View>
          <Text className="mt-2 text-xs leading-relaxed text-muted-foreground">
            記録・診断・レポート・AIコーチの会話履歴をダウンロードできます
          </Text>
        </View>

        <View>
          <Text className="mb-3 text-sm font-semibold text-muted-foreground">アカウントの削除</Text>
          <View className="overflow-hidden rounded-xl border border-rose-100 bg-white shadow-sm">
            <Pressable onPress={() => setDeleteOpen(true)} className="flex-row items-center gap-2 px-4 py-3">
              <Icon name="delete_forever" size={18} color="#E11D48" />
              <Text className="text-sm text-rose-600">アカウントとすべてのデータを削除</Text>
            </Pressable>
          </View>
          <Text className="mt-2 text-xs leading-relaxed text-muted-foreground">
            削除すると、記録・レポート・会話履歴を含むすべてのデータが完全に消去され、元に戻せません
          </Text>
        </View>
      </ScrollView>

      <Modal visible={deleteOpen} transparent animationType="fade">
        <View className="flex-1 items-center justify-center bg-black/40 px-6">
          <View className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <View className="mb-4 h-12 w-12 items-center justify-center rounded-xl bg-rose-50">
              <Icon name="warning" filled size={22} color="#F43F5E" />
            </View>
            <Text className="mb-2 text-lg font-bold text-foreground">本当に削除しますか？</Text>
            <Text className="mb-4 text-sm leading-relaxed text-muted-foreground">
              すべての記録・診断・レポート・会話履歴が完全に削除されます。この操作は取り消せません。
              必要ならエクスポートを先に行ってください。
            </Text>
            <Text className="mb-2 text-xs text-muted-foreground">
              確認のため「<Text className="font-bold">削除</Text>」と入力してください
            </Text>
            <TextInput
              value={deleteConfirm}
              onChangeText={setDeleteConfirm}
              placeholder="削除"
              className="mb-4 rounded-xl border border-border px-3 py-2.5 text-sm text-foreground"
            />
            <View className="flex-row gap-2">
              <Pressable
                onPress={() => {
                  setDeleteOpen(false);
                  setDeleteConfirm('');
                }}
                className="flex-1 rounded-xl border border-border py-2.5"
              >
                <Text className="text-center text-sm font-semibold text-muted-foreground">キャンセル</Text>
              </Pressable>
              <Pressable
                onPress={() => deleteMutation.mutate()}
                disabled={deleteConfirm !== '削除' || deleteMutation.isPending}
                className={`flex-1 rounded-xl bg-rose-600 py-2.5 ${
                  deleteConfirm !== '削除' || deleteMutation.isPending ? 'opacity-40' : ''
                }`}
              >
                <Text className="text-center text-sm font-semibold text-white">
                  {deleteMutation.isPending ? '削除中…' : '完全に削除する'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
