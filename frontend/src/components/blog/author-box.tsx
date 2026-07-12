import { Icon } from '@/components/ui/icon';

export function AuthorBox() {
  return (
    <div className="not-prose mt-10 rounded-2xl border border-border bg-card p-5 flex gap-4">
      <span className="w-11 h-11 rounded-full bg-primary flex items-center justify-center shrink-0">
        <Icon name="balance" className="text-lg text-primary-foreground" />
      </span>
      <div>
        <p className="font-bold text-foreground text-sm">ココロバランス編集部</p>
        <p className="text-xs text-muted-foreground leading-relaxed mt-1">
          心理学・行動科学の公開研究や書籍を参照しながら、日常で実践しやすいセルフケアの知恵をまとめています。強い不調が続く場合は、自己判断だけに頼らず医療機関や専門家にご相談ください。
        </p>
      </div>
    </div>
  );
}
