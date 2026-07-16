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
  const summary = data.map((d) => `${d.name} ${d.value}`).join('、');

  return (
    <figure className="not-prose my-8">
      <div aria-hidden="true">
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
      </div>
      <span className="sr-only">
        {caption ? `${caption}：` : ''}
        {summary}
      </span>
      {caption && (
        <figcaption aria-hidden="true" className="text-center text-xs text-muted-foreground mt-2">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
