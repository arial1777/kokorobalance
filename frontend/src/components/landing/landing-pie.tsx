'use client';

import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

export interface LandingPieDatum {
  name: string;
  value: number; // シェア%
  color: string;
}

interface LandingPieProps {
  data: LandingPieDatum[];
  height?: number;
}

/**
 * LP専用の軽量ドーナツチャート。データ変化時のトゥイーン（recharts標準）が
 * 「タップで円グラフが動く」体験の核。中央のトップカテゴリ表示は
 * rechartsのラベルではなくオーバーレイdivで即時更新する。
 */
export function LandingPie({ data, height = 220 }: LandingPieProps) {
  const top = data[0];

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <div className="w-40 h-40 rounded-full border-4 border-dashed border-border flex items-center justify-center">
          <p className="text-xs text-muted-foreground text-center px-6 leading-relaxed">
            タップすると
            <br />
            円グラフが動きます
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius="58%"
            outerRadius="90%"
            strokeWidth={2}
            animationDuration={500}
          >
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      {top && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <p className="text-sm font-bold text-foreground">{top.name}</p>
          <p className="text-2xl font-bold" style={{ color: top.color }}>
            {top.value}%
          </p>
        </div>
      )}
    </div>
  );
}
