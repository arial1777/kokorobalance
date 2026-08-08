import { View, Text, Pressable, Linking } from 'react-native';
import type { HotlineView } from '@/types';

interface SafetyResourceCardProps {
  /** block: 遮断して窓口のみ提示 / caution: 通常応答の下に窓口を小さく併記 */
  variant: 'block' | 'caution';
  hotlines: HotlineView[];
  onDelete?: () => void;
}

/**
 * クライシス検知時の相談窓口カード（03-spec-safety.md §4.1/4.2）。
 * 警告色は使わず、電話番号はタップで発信できるようにする。
 */
export function SafetyResourceCard({ variant, hotlines, onDelete }: SafetyResourceCardProps) {
  if (hotlines.length === 0) return null;

  if (variant === 'caution') {
    return (
      <View className="mt-2 rounded-xl border border-sky-100 bg-sky-50/60 px-3 py-2">
        <Text className="mb-1.5 text-xs text-muted-foreground">しんどくなったら、いつでもここに話せます</Text>
        <View className="flex-row flex-wrap gap-x-3 gap-y-1">
          {hotlines.map((h) => (
            <Text
              key={h.phone}
              className="text-xs font-semibold text-accent"
              onPress={() => Linking.openURL(`tel:${h.phone.replace(/[^\d#]/g, '')}`)}
            >
              {h.name} {h.phone}
            </Text>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View className="max-w-[85%] rounded-2xl border border-sky-100 bg-white px-4 py-4 shadow-sm">
      <Text className="mb-1 text-sm leading-relaxed text-foreground">
        いま、ひとりで抱えるにはしんどい話だと思います。
      </Text>
      <Text className="mb-3 text-sm leading-relaxed text-muted-foreground">
        このアプリでは、ここから先はお話しできません。かわりに、つながる窓口をお伝えします。
      </Text>
      <View className="mb-3 gap-2">
        {hotlines.map((h) => (
          <Pressable
            key={h.phone}
            onPress={() => Linking.openURL(`tel:${h.phone.replace(/[^\d#]/g, '')}`)}
            className="flex-row items-center justify-between rounded-xl bg-sky-50 px-3 py-2.5 active:bg-sky-100"
          >
            <View className="flex-1">
              <Text className="font-semibold text-foreground">{h.name}</Text>
              <Text className="text-xs text-muted-foreground">
                {h.phone}（{h.hoursText}）
              </Text>
            </View>
            <Text className="ml-2 shrink-0 text-xs font-semibold text-accent">電話をかける</Text>
          </Pressable>
        ))}
      </View>
      <Text className="text-[11px] text-muted-foreground">
        書いてくれた内容は保存されています。
        {onDelete && (
          <Text className="text-accent" onPress={onDelete}>
            {' '}
            消したいときはこちら
          </Text>
        )}
      </Text>
    </View>
  );
}
