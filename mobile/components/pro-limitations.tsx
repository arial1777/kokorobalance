import { View, Text } from 'react-native';

/**
 * 「Pro でも できないこと」（10-pricing-b2b.md §2.5、M-A-02）。
 *
 * 競合レビューの不満の大半が「課金前に知らされなかった」であることを踏まえ、
 * **購入前に制限を先に書く**。この市場でこれをやっているアプリはほぼ存在しない。
 */
export function ProLimitations() {
  return (
    <View className="rounded-2xl border border-border bg-white p-5">
      <Text className="mb-3 text-sm font-semibold text-foreground">Pro でも できないこと</Text>
      <View className="gap-2">
        <View>
          <Text className="text-xs leading-relaxed text-muted-foreground">
            ・壁打ちは、これまでの会話を全部は覚えていません
          </Text>
          <Text className="text-[11px] leading-relaxed text-muted-foreground">
            　（直近4週分の要約を引き継ぎます）
          </Text>
        </View>
        <Text className="text-xs leading-relaxed text-muted-foreground">・医療的な相談には答えられません</Text>
        <Text className="text-xs leading-relaxed text-muted-foreground">・危機的な状況では、窓口をご案内します</Text>
      </View>
    </View>
  );
}
