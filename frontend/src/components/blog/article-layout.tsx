import Link from 'next/link';
import { Icon } from '@/components/ui/icon';

export function ArticleLayout({ children }: { children: React.ReactNode }) {
  return (
    <article className="max-w-3xl mx-auto px-4 md:px-8 pb-16">
      <div className="prose prose-neutral max-w-none prose-headings:text-foreground prose-headings:font-bold prose-p:text-foreground prose-p:leading-relaxed prose-a:text-accent prose-strong:text-foreground prose-li:text-foreground">
        {children}
      </div>

      <div className="mt-12 bg-gradient-to-br from-[#1A3352] to-[#0F1F35] rounded-2xl p-8 text-white text-center shadow-xl shadow-black/10">
        <p className="text-lg font-bold mb-2">今日から、心の柱を育てはじめよう</p>
        <p className="text-sm opacity-60 mb-5">無料プランで全ての基本機能が使えます</p>
        <Link
          href="/signup"
          className="inline-flex items-center gap-1.5 px-6 py-2.5 bg-[#E05A3A] text-white font-bold rounded-xl hover:bg-[#c94d30] transition text-sm"
        >
          無料で本格診断をする
          <Icon name="chevron_right" className="text-lg" />
        </Link>
      </div>

      <div className="mt-8 text-center">
        <Link href="/blog" className="text-sm text-muted-foreground hover:text-foreground font-medium">
          ← ブログ一覧に戻る
        </Link>
      </div>
    </article>
  );
}
