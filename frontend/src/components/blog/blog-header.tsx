import Link from 'next/link';
import { Icon } from '@/components/ui/icon';

export function BlogHeader() {
  return (
    <header className="px-4 md:px-8 py-4 flex items-center justify-between max-w-3xl mx-auto">
      <Link href="/" className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
          <Icon name="donut_large" filled className="text-base text-white" />
        </div>
        <span className="font-bold text-foreground text-sm">ココロバランス</span>
      </Link>
      <div className="flex gap-3 items-center">
        <Link href="/blog" className="text-sm text-muted-foreground hover:text-foreground font-medium">ブログ</Link>
        <Link href="/signup" className="text-sm px-4 py-1.5 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 transition shadow-sm shadow-primary/15">無料登録</Link>
      </div>
    </header>
  );
}
