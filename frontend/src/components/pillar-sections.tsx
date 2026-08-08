import type { PillarItem, PillarKind, PortfolioPillars } from '@/types';

/** 柱の型のUI表記（07-spec-pillars.md §2.1） */
export const KIND_LABEL: Record<PillarKind, string> = {
  place: '居場所',
  relation: '相手',
  habit: '習慣',
};

interface PillarSectionsProps {
  pillars: PortfolioPillars;
  /** 見出しを出さずに一覧だけ描画する（ふりかえりタブなど） */
  compact?: boolean;
}

function PillarRow({ item }: { item: PillarItem }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
      <span className="text-sm font-medium flex-1 min-w-0 truncate">{item.categoryName}</span>
      <span className="text-xs text-muted-foreground">{KIND_LABEL[item.kind]}</span>
    </div>
  );
}

function Section({ title, note, items }: { title: string; note?: string; items: PillarItem[] }) {
  // 0件のセクションは出さない。「0本」を表示しない（07 §3.5 P-03、原則4）
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{title}</p>
      {note && <p className="text-[11px] text-muted-foreground mb-2.5 leading-relaxed">{note}</p>}
      <div className="space-y-2.5">
        {items.map((p) => (
          <PillarRow key={p.categoryId} item={p} />
        ))}
      </div>
    </div>
  );
}

/**
 * 柱を「確かな柱 / 育て中 / 習慣」に分けて表示する（07 §3.5 P-02）。
 * 本数は出さず、合計値も強調しない。習慣を二軍扱いのUIにしない（§2.2）。
 */
export function PillarSections({ pillars, compact }: PillarSectionsProps) {
  const isEmpty =
    pillars.verified.length === 0 && pillars.growing.length === 0 && pillars.habits.length === 0;
  if (isEmpty) return null;

  const body = (
    <div className="space-y-5">
      <Section title="確かな柱" items={pillars.verified} />
      <Section title="育て中" items={pillars.growing} />
      <Section title="習慣" items={pillars.habits} />
    </div>
  );

  if (compact) return body;

  return <div className="bg-white rounded-2xl border border-border shadow-sm p-5">{body}</div>;
}
