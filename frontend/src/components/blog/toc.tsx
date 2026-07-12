import type { Heading } from '@/lib/blog';

export function TableOfContents({ headings }: { headings: Heading[] }) {
  if (headings.length === 0) return null;

  return (
    <details className="not-prose mb-8 rounded-2xl border border-border bg-card p-5 shadow-sm" open>
      <summary className="font-bold text-foreground cursor-pointer select-none">目次</summary>
      <nav className="mt-3">
        <ol className="space-y-1.5">
          {headings.map((heading) => (
            <li key={heading.id} className={heading.depth === 3 ? 'ml-4' : ''}>
              <a
                href={`#${heading.id}`}
                className="text-sm text-muted-foreground hover:text-accent transition leading-snug"
              >
                {heading.text}
              </a>
            </li>
          ))}
        </ol>
      </nav>
    </details>
  );
}
