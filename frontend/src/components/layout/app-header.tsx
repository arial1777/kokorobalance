'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/icon';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  back?: boolean;
  right?: React.ReactNode;
}

export function AppHeader({ title, subtitle, back = false, right }: AppHeaderProps) {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="flex items-center h-14 px-4 md:px-6 gap-3">
        {back ? (
          <button
            onClick={() => router.back()}
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-secondary transition shrink-0 -ml-1"
          >
            <Icon name="arrow_back" className="text-xl text-foreground" />
          </button>
        ) : (
          <Link href="/dashboard" className="flex items-center gap-2 shrink-0 md:hidden">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Icon name="donut_large" filled className="text-base text-white" />
            </div>
            <span className="text-sm font-bold text-foreground">ココロバランス</span>
          </Link>
        )}

        <div className="flex-1 min-w-0">
          {back ? (
            <>
              {subtitle && (
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider leading-none mb-0.5">
                  {subtitle}
                </p>
              )}
              <h1 className="text-base font-bold text-foreground truncate leading-tight">{title}</h1>
            </>
          ) : (
            <div className="hidden md:block">
              {subtitle && (
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider leading-none mb-0.5">
                  {subtitle}
                </p>
              )}
              <h1 className="text-base font-bold text-foreground truncate leading-tight">{title}</h1>
            </div>
          )}
        </div>

        {right && <div className="shrink-0">{right}</div>}
      </div>
    </header>
  );
}
