import type { PostFaq } from '@/lib/blog';
import { Icon } from '@/components/ui/icon';

export function FAQSection({ faqs }: { faqs: PostFaq[] }) {
  if (faqs.length === 0) return null;

  return (
    <div className="not-prose mt-10">
      <p className="font-bold text-foreground mb-3">よくある質問</p>
      <div className="space-y-2">
        {faqs.map((faq) => (
          <details key={faq.question} className="group rounded-2xl border border-border bg-card p-4">
            <summary className="flex items-center justify-between gap-3 cursor-pointer select-none font-medium text-sm text-foreground">
              {faq.question}
              <Icon name="expand_more" className="text-lg text-muted-foreground shrink-0 transition group-open:rotate-180" />
            </summary>
            <p className="text-sm text-muted-foreground leading-relaxed mt-3 pt-3 border-t border-border">
              {faq.answer}
            </p>
          </details>
        ))}
      </div>
    </div>
  );
}
