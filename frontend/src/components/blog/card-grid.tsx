import { Icon } from '@/components/ui/icon';

export interface CardGridItem {
  icon: string;
  title: string;
  subtitle?: string;
  items: string[];
}

export function CardGrid({ cards }: { cards: CardGridItem[] }) {
  return (
    <div className="not-prose my-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
      {cards.map((card) => (
        <div key={card.title} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center shrink-0">
              <Icon name={card.icon} className="text-lg text-primary" />
            </span>
            <div>
              <p className="font-bold text-foreground text-sm leading-tight">{card.title}</p>
              {card.subtitle && <p className="text-xs text-muted-foreground">{card.subtitle}</p>}
            </div>
          </div>
          <ul className="mt-3 space-y-1.5">
            {card.items.map((item) => (
              <li key={item} className="text-sm text-foreground leading-snug flex gap-2">
                <span className="text-accent">・</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
