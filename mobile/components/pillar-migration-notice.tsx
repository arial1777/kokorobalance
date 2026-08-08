import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Icon } from '@/components/ui/icon';
import type { Profile } from '@/types';

/**
 * 柱の再定義の移行通知（07-spec-pillars.md §5、P-A-12）。一度閉じたら二度と出さない。
 * 「柱が減った」と受け取られる変更なので、必ず理由を添えて説明する。
 */
export function PillarMigrationNotice({ profile }: { profile: Profile | undefined }) {
  const qc = useQueryClient();
  const router = useRouter();

  const dismissMutation = useMutation({
    mutationFn: () => api.patch<Profile>('/profile', { pillarNoticeDismissed: true }),
    onSuccess: (updated) => qc.setQueryData(['profile'], updated),
  });

  if (!profile || profile.pillarNoticeDismissedAt) return null;

  return (
    <View className="rounded-2xl border border-border bg-white p-5 shadow-sm">
      <View className="flex-row items-start gap-3">
        <View className="h-8 w-8 items-center justify-center rounded-full bg-secondary">
          <Icon name="info" size={18} color="#6B5848" />
        </View>
        <View className="flex-1">
          <Text className="mb-1.5 text-sm font-semibold text-foreground">柱の考え方を見直しました</Text>
          <Text className="mb-2 text-xs leading-relaxed text-muted-foreground">
            ひとりで完結するもの（睡眠・筋トレなど）は「習慣」に整理しました。
            <Text className="font-semibold text-foreground">減ったわけではありません。</Text>
            人や居場所とのつながりだけを「柱」と呼ぶことにしたのは、そこにいちばん確かな研究の裏付けがあるからです。
          </Text>
          <Text className="mb-3 text-xs leading-relaxed text-muted-foreground">
            よければ、居場所を1つ登録してみませんか？
          </Text>
          <View className="flex-row items-center gap-4">
            <Pressable
              onPress={() => {
                dismissMutation.mutate();
                router.push('/settings');
              }}
            >
              <Text className="text-xs font-semibold text-accent">柱を見に行く</Text>
            </Pressable>
            <Pressable onPress={() => dismissMutation.mutate()} disabled={dismissMutation.isPending}>
              <Text className="text-xs text-muted-foreground">閉じる</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}
