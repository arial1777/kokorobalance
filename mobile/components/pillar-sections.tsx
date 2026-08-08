import { View, Text } from 'react-native';
import type { PillarItem, PillarKind, PortfolioPillars } from '@/types';

/** 柱の型のUI表記（07-spec-pillars.md §2.1） */
export const KIND_LABEL: Record<PillarKind, string> = {
  place: '居場所',
  relation: '相手',
  habit: '習慣',
};

function PillarRow({ item }: { item: PillarItem }) {
  return (
    <View className="flex-row items-center gap-3">
      <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
      <Text className="flex-1 text-sm font-medium text-foreground" numberOfLines={1}>
        {item.categoryName}
      </Text>
      <Text className="text-xs text-muted-foreground">{KIND_LABEL[item.kind]}</Text>
    </View>
  );
}

function Section({ title, items }: { title: string; items: PillarItem[] }) {
  // 0件のセクションは出さない。「0本」を表示しない（07 §3.5 P-03、原則4）
  if (items.length === 0) return null;
  return (
    <View>
      <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</Text>
      <View className="gap-2.5">
        {items.map((p) => (
          <PillarRow key={p.categoryId} item={p} />
        ))}
      </View>
    </View>
  );
}

/**
 * 柱を「確かな柱 / 育て中 / 習慣」に分けて表示する（07 §3.5 P-02）。
 * 本数は出さず、合計値も強調しない。習慣を二軍扱いのUIにしない（§2.2）。
 */
export function PillarSections({ pillars, compact }: { pillars: PortfolioPillars; compact?: boolean }) {
  const isEmpty =
    pillars.verified.length === 0 && pillars.growing.length === 0 && pillars.habits.length === 0;
  if (isEmpty) return null;

  const body = (
    <View className="gap-5">
      <Section title="確かな柱" items={pillars.verified} />
      <Section title="育て中" items={pillars.growing} />
      <Section title="習慣" items={pillars.habits} />
    </View>
  );

  if (compact) return body;

  return <View className="rounded-2xl border border-border bg-white p-5 shadow-sm">{body}</View>;
}
