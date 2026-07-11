'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/ui/icon';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'ホーム', icon: 'home' },
  { href: '/record', label: '記録', icon: 'edit' },
  { href: '/portfolio', label: 'ポートフォリオ', icon: 'donut_large' },
  { href: '/report', label: 'レポート', icon: 'description' },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-56 shrink-0 h-screen sticky top-0 bg-white border-r border-border overflow-y-auto">
      <div className="p-5 pb-4 border-b border-border">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center">
            <Icon name="donut_large" filled className="text-[18px] text-white" />
          </div>
          <span className="font-bold text-foreground text-sm">ココロバランス</span>
        </Link>
      </div>

      <nav className="flex-1 p-3 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                active
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              }`}
            >
              <Icon name={item.icon} filled={active} className="text-xl shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-border">
        <Link
          href="/settings"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        >
          <Icon name="settings" className="text-xl shrink-0" />
          設定
        </Link>
      </div>
    </aside>
  );
}
