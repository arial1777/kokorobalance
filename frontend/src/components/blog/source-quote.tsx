import { Icon } from '@/components/ui/icon';

export function SourceQuote({
  sourceLabel,
  sourceUrl,
  children,
}: {
  sourceLabel: string;
  sourceUrl: string;
  children: React.ReactNode;
}) {
  return (
    <figure className="not-prose my-6 rounded-2xl bg-card border border-border p-5 shadow-sm">
      <blockquote className="text-sm leading-relaxed text-foreground italic [&>p]:m-0 [&>p+p]:mt-2">
        {children}
      </blockquote>
      <figcaption className="mt-3 pt-3 border-t border-border">
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-accent transition"
        >
          出典：{sourceLabel}
          <Icon name="open_in_new" className="text-sm" />
        </a>
      </figcaption>
    </figure>
  );
}
