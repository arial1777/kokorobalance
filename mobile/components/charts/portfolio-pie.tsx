import { View, Text } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';
import type { PortfolioBreakdownItem } from '@/types';

interface PortfolioPieProps {
  breakdown: PortfolioBreakdownItem[];
  compact?: boolean;
}

export function PortfolioPie({ breakdown, compact = false }: PortfolioPieProps) {
  if (breakdown.length === 0) {
    return (
      <View className="h-40 items-center justify-center">
        <Text className="text-sm text-muted-foreground">まだデータがありません</Text>
      </View>
    );
  }

  const data = breakdown.map((item) => ({ value: item.percentage, color: item.color }));

  return (
    <View className="items-center">
      <PieChart
        data={data}
        radius={compact ? 70 : 100}
        donut
        innerRadius={compact ? 40 : 55}
        innerCircleColor="#FFFFFF"
      />
      {!compact && (
        <View className="mt-4 w-full flex-row flex-wrap justify-center gap-x-4 gap-y-2">
          {breakdown.map((item, i) => (
            <View key={i} className="flex-row items-center gap-1.5">
              <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              <Text className="text-xs text-muted-foreground">
                {item.categoryName} {item.percentage}%
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
