import { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { track } from '@/lib/analytics';

/**
 * 課金訴求（10-pricing-b2b.md §2.4）。
 *
 * §2.4 の禁止事項に沿って、**モーダルで被せない**（M-A-03）。画面内の1ブロックとして
 * 静かに置き、「あとで」で消せる。プッシュ通知には出さない（M-A-05）。
 * 揺れイベントの当日には出さない（M-A-04）— 呼び出し側がタイミングを保証する。
 */
export function ProUpsell({ route, headline, body }: { route: string; headline: string; body: string }) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    track('paywall_shown', { route });
  }, [route]);

  if (dismissed) return null;

  return (
    <View className="rounded-2xl border border-border bg-white p-5 shadow-sm">
      <Text className="mb-1 text-sm font-semibold text-foreground">{headline}</Text>
      <Text className="mb-4 text-xs leading-relaxed text-muted-foreground">{body}</Text>
      <View className="flex-row gap-2">
        <Pressable
          onPress={() => {
            setDismissed(true);
            track('paywall_dismissed', { route });
          }}
          className="flex-1 items-center rounded-xl border border-border py-2.5"
        >
          <Text className="text-xs font-semibold text-muted-foreground">あとで</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/paywall')}
          className="flex-1 items-center rounded-xl bg-accent py-2.5"
        >
          <Text className="text-xs font-semibold text-white">Proを見る</Text>
        </Pressable>
      </View>
    </View>
  );
}
