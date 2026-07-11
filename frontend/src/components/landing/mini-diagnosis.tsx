'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { LandingPie, type LandingPieDatum } from './landing-pie';
import {
  BALANCED_PILLARS,
  BALANCED_TOP_SHARE,
  FEW_PILLARS_THRESHOLD,
  LANDING_CHIPS,
  TOP_SHARE_THRESHOLD,
} from './landing-data';
import { saveLpDiagnosis } from '@/lib/lp-diagnosis';

type Level = 1 | 2 | 3;

const LEVEL_DOTS: Record<Level, string> = { 1: '●○○', 2: '●●○', 3: '●●●' };

/** 重み → シェア%（最大剰余法で合計をちょうど100にする） */
function toBreakdown(levels: Record<string, Level>): LandingPieDatum[] {
  const entries = LANDING_CHIPS.filter((c) => levels[c.presetName]);
  const total = entries.reduce((s, c) => s + levels[c.presetName], 0);
  if (total === 0) return [];

  const raw = entries.map((c) => ({
    name: c.label,
    color: c.color,
    exact: (levels[c.presetName] / total) * 100,
  }));
  const floored = raw.map((r) => ({ ...r, value: Math.floor(r.exact) }));
  let remainder = 100 - floored.reduce((s, r) => s + r.value, 0);
  const byFraction = [...floored].sort((a, b) => (b.exact - Math.floor(b.exact)) - (a.exact - Math.floor(a.exact)));
  for (const item of byFraction) {
    if (remainder <= 0) break;
    item.value += 1;
    remainder -= 1;
  }
  return floored
    .map(({ name, color, value }) => ({ name, color, value }))
    .sort((a, b) => b.value - a.value);
}

function buildInsight(data: LandingPieDatum[]): string | null {
  if (data.length === 0) return null;
  const top = data[0];
  const pillarCount = data.length;

  if (top.value >= TOP_SHARE_THRESHOLD) {
    return `いま、あなたの心は「${top.name}」が${top.value}%を支えています。もしそれが揺らいだら…？`;
  }
  if (pillarCount <= FEW_PILLARS_THRESHOLD) {
    return `柱は${pillarCount}本。もう1本あると、心はぐっと安定します。`;
  }
  if (pillarCount >= BALANCED_PILLARS && top.value < BALANCED_TOP_SHARE) {
    return `${pillarCount}本の柱でバランスよく支えられています。記録で育てていきましょう。`;
  }
  return `${pillarCount}本の柱があなたを支えています。この形、キープできそうですか？`;
}

export function MiniDiagnosis() {
  const [levels, setLevels] = useState<Record<string, Level>>({});

  const breakdown = useMemo(() => toBreakdown(levels), [levels]);
  const insight = buildInsight(breakdown);

  function cycleChip(presetName: string) {
    setLevels((prev) => {
      const next = { ...prev };
      const current = next[presetName];
      if (current === undefined) next[presetName] = 1;
      else if (current < 3) next[presetName] = (current + 1) as Level;
      else delete next[presetName];
      return next;
    });
  }

  function handleCtaClick() {
    saveLpDiagnosis(
      Object.entries(levels).map(([presetName, level]) => ({ presetName, level })),
    );
  }

  return (
    <div className="bg-white rounded-3xl border border-border shadow-sm p-6 md:p-8">
      <div className="text-center mb-6">
        <h3 className="text-xl md:text-2xl font-bold text-foreground mb-2">
          最近、あなたの心を満たしてくれたものは？
        </h3>
        <p className="text-xs md:text-sm text-muted-foreground">
          あてはまるものをタップ。もう一度タップで度合いが上がります
        </p>
      </div>

      <div className="md:grid md:grid-cols-2 md:gap-8 md:items-center">
        {/* チップ */}
        <div className="flex flex-wrap justify-center md:justify-start gap-2 mb-6 md:mb-0">
          {LANDING_CHIPS.map((chip) => {
            const level = levels[chip.presetName];
            const isSelected = level !== undefined;
            return (
              <button
                key={chip.presetName}
                type="button"
                onClick={() => cycleChip(chip.presetName)}
                aria-pressed={isSelected}
                aria-label={
                  isSelected ? `${chip.label}（度合い${level}/3）` : chip.label
                }
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-medium border-2 transition-all min-h-[44px] ${
                  isSelected
                    ? 'text-white border-transparent shadow-sm scale-105'
                    : 'border-border bg-white text-foreground hover:border-primary/30'
                }`}
                style={isSelected ? { backgroundColor: chip.color, borderColor: chip.color } : {}}
              >
                {chip.label}
                {isSelected && (
                  <span className="text-[10px] tracking-tight opacity-90">{LEVEL_DOTS[level]}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* 円グラフ + インサイト */}
        <div>
          <LandingPie data={breakdown} />
          <div aria-live="polite" className="min-h-[3.5rem] mt-3 flex items-center justify-center">
            {insight && (
              <p
                key={insight}
                className="text-sm text-center text-foreground font-medium leading-relaxed animate-in fade-in duration-500 px-2"
              >
                {insight}
              </p>
            )}
          </div>
        </div>
      </div>

      {breakdown.length > 0 && (
        <div className="text-center mt-5 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <Link
            href="/signup"
            onClick={handleCtaClick}
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-accent text-white font-bold rounded-xl hover:bg-[#c94d30] transition shadow-lg shadow-accent/20 text-sm md:text-base"
          >
            無料で本格診断へ（1分）
          </Link>
          <p className="text-[11px] text-muted-foreground mt-2.5">
            いまの選択は、登録後の診断に引き継がれます
          </p>
        </div>
      )}
    </div>
  );
}
