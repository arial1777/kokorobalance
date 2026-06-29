'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'ホーム', icon: '🏠' },
  { href: '/record', label: '記録', icon: '✏️' },
  { href: '/portfolio', label: 'ポートフォリオ', icon: '📊' },
  { href: '/report', label: 'レポート', icon: '📋' },
  { href: '/coach', label: 'AIコーチ', icon: '🤖' },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
      <div className="max-w-lg mx-auto flex">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center py-2 text-xs transition ${
                active ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="mt-0.5">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
