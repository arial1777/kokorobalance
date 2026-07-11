import { View, Text } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import type { PortfolioBreakdownItem } from '@/types';

export function PortfolioBarHorizontal({ breakdown }: { breakdown: PortfolioBreakdownItem[] }) {
  if (breakdown.length === 0) {
    return (
      <View className="h-40 items-center justify-center">
        <Text className="text-sm text-muted-foreground">まだデータがありません</Text>
      </View>
    );
  }

  const data = breakdown.map((item) => ({
    value: item.percentage,
    label: item.categoryName,
    frontColor: item.color,
  }));

  return (
    <BarChart
      data={data}
      horizontal
      maxValue={100}
      noOfSections={4}
      barWidth={18}
      spacing={22}
      height={Math.max(120, breakdown.length * 40)}
      yAxisThickness={0}
      xAxisThickness={0}
      rulesType="dashed"
      yAxisTextStyle={{ fontSize: 11, color: '#6B5848' }}
      xAxisLabelTextStyle={{ fontSize: 11, color: '#6B5848' }}
      formatYLabel={(v) => `${v}%`}
    />
  );
}

interface WeeklyTrendItem {
  weekStart: string;
  total: number;
}

export function WeeklyTrendBar({ data }: { data: WeeklyTrendItem[] }) {
  const chartData = data.map((d) => ({
    value: d.total,
    label: d.weekStart.slice(5).replace('-', '/'),
    frontColor: '#1A3352',
  }));

  return (
    <BarChart
      data={chartData}
      height={140}
      barWidth={22}
      spacing={18}
      roundedTop
      yAxisThickness={0}
      xAxisThickness={0}
      xAxisLabelTextStyle={{ fontSize: 10, color: '#6B5848' }}
      yAxisTextStyle={{ fontSize: 10, color: '#6B5848' }}
      noOfSections={3}
    />
  );
}
