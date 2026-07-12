import { Icon } from '@/components/ui/icon';

type CalloutVariant = 'tip' | 'note' | 'practice' | 'warning';

const VARIANT_STYLES: Record<CalloutVariant, { icon: string; className: string; iconClassName: string }> = {
  tip: {
    icon: 'lightbulb',
    className: 'bg-[oklch(0.560_0.090_160_/_0.1)] border-[oklch(0.560_0.090_160_/_0.35)]',
    iconClassName: 'text-[oklch(0.420_0.090_160)]',
  },
  note: {
    icon: 'info',
    className: 'bg-secondary border-border',
    iconClassName: 'text-primary',
  },
  practice: {
    icon: 'edit_note',
    className: 'bg-[oklch(0.620_0.160_25_/_0.08)] border-[oklch(0.620_0.160_25_/_0.3)]',
    iconClassName: 'text-accent',
  },
  warning: {
    icon: 'error',
    className: 'bg-[oklch(0.680_0.130_80_/_0.12)] border-[oklch(0.680_0.130_80_/_0.4)]',
    iconClassName: 'text-[oklch(0.480_0.130_60)]',
  },
};

export function Callout({
  variant = 'note',
  title,
  children,
}: {
  variant?: CalloutVariant;
  title?: string;
  children: React.ReactNode;
}) {
  const style = VARIANT_STYLES[variant];

  return (
    <div className={`not-prose my-6 rounded-2xl border p-5 ${style.className}`}>
      <div className="flex gap-3">
        <Icon name={style.icon} className={`text-xl shrink-0 ${style.iconClassName}`} filled />
        <div className="text-sm leading-relaxed text-foreground [&>p]:m-0 [&>p+p]:mt-2">
          {title && <p className="font-bold mb-1">{title}</p>}
          {children}
        </div>
      </div>
    </div>
  );
}
