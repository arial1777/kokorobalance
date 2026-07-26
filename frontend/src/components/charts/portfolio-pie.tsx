'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import type { PortfolioBreakdownItem } from '@/types';

interface PortfolioPieProps {
  breakdown: PortfolioBreakdownItem[];
  compact?: boolean;
}

export function PortfolioPie({ breakdown, compact = false }: PortfolioPieProps) {
  if (breakdown.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
        まだデータがありません
      </div>
    );
  }

  const height = compact ? 200 : 220;

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={breakdown}
            dataKey="percentage"
            nameKey="categoryName"
            cx="50%"
            cy="50%"
            outerRadius={compact ? 70 : 100}
          >
            {breakdown.map((item, i) => (
              <Cell key={i} fill={item.color} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => [`${value}%`, '割合']} />
        </PieChart>
      </ResponsiveContainer>
      {/* recharts の Legend/ラベルはカテゴリ数が多いと横にはみ出すため、折り返し可能な独自レイアウトで表示する */}
      {!compact && (
        <div className="mt-4 flex w-full flex-wrap justify-center gap-x-4 gap-y-2">
          {breakdown.map((item, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
              <span className="text-xs text-muted-foreground">
                {item.categoryName} {item.percentage}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
