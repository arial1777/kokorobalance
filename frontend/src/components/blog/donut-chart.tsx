'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { CHART_PALETTE } from './chart-colors';

export interface DonutChartDatum {
  name: string;
  value: number;
}

export function DonutChart({
  data,
  caption,
}: {
  data: DonutChartDatum[];
  caption?: string;
}) {
  return (
    <figure className="not-prose my-8">
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={95}
            paddingAngle={2}
          >
            {data.map((entry, i) => (
              <Cell key={entry.name} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
      {caption && (
        <figcaption className="text-center text-xs text-muted-foreground mt-2">{caption}</figcaption>
      )}
    </figure>
  );
}
