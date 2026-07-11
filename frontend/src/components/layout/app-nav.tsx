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

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-border md:hidden">
      <div className="max-w-lg mx-auto flex items-stretch h-[72px]">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
                active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-b-full bg-accent" />
              )}
              <Icon name={item.icon} filled={active} className="text-[26px]" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
