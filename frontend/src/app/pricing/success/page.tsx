import Link from 'next/link';
import { Icon } from '@/components/ui/icon';

export default function PricingSuccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="text-center max-w-sm">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-100 mb-5">
          <Icon name="check_circle" filled className="text-5xl text-emerald-600" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Proプランへようこそ！</h1>
        <p className="text-muted-foreground text-sm mb-8 leading-relaxed">
          AIコーチを含む全機能がご利用いただけます。
        </p>
        <Link
          href="/coach"
          className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-white font-semibold rounded-xl hover:bg-[#c94d30] transition shadow-sm shadow-accent/20 text-sm"
        >
          AIコーチを使ってみる
          <Icon name="chevron_right" className="text-lg" />
        </Link>
      </div>
    </div>
  );
}
