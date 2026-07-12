'use client';

import { BarChart as RBarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { CHART_COLORS } from './chart-colors';

export interface BarChartDatum {
  name: string;
  value: number;
}

export function BarChart({
  data,
  unit,
  caption,
}: {
  data: BarChartDatum[];
  unit?: string;
  caption?: string;
}) {
  return (
    <figure className="not-prose my-8">
      <ResponsiveContainer width="100%" height={260}>
        <RBarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.905 0.020 70)" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} unit={unit} />
          <Tooltip formatter={(value) => [`${value}${unit ?? ''}`, '']} />
          <Bar dataKey="value" fill={CHART_COLORS.coral} radius={[6, 6, 0, 0]} />
        </RBarChart>
      </ResponsiveContainer>
      {caption && (
        <figcaption className="text-center text-xs text-muted-foreground mt-2">{caption}</figcaption>
      )}
    </figure>
  );
}
