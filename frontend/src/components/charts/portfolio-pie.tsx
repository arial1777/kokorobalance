'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
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

  const height = compact ? 200 : 300;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={breakdown}
          dataKey="percentage"
          nameKey="categoryName"
          cx="50%"
          cy="50%"
          outerRadius={compact ? 70 : 100}
          label={compact ? undefined : (props) => `${props.name} ${props.value}%`}
          labelLine={!compact}
        >
          {breakdown.map((item, i) => (
            <Cell key={i} fill={item.color} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => [`${value}%`, '割合']} />
        {!compact && <Legend formatter={(value) => value} />}
      </PieChart>
    </ResponsiveContainer>
  );
}
