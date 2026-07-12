/** Mirrors the --chart-1..5 tokens in globals.css. Kept as literal values because
 * SVG fill attributes (used by recharts) don't reliably resolve CSS custom properties
 * across all rendering paths (e.g. static export, PDF/OG snapshotting). */
export const CHART_COLORS = {
  coral: 'oklch(0.620 0.160 25)',
  navy: 'oklch(0.280 0.075 240)',
  teal: 'oklch(0.520 0.120 200)',
  amber: 'oklch(0.680 0.130 80)',
  sage: 'oklch(0.560 0.090 160)',
} as const;

export const CHART_PALETTE = [
  CHART_COLORS.coral,
  CHART_COLORS.navy,
  CHART_COLORS.teal,
  CHART_COLORS.amber,
  CHART_COLORS.sage,
];
