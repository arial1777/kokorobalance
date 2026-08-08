'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { track } from '@/lib/analytics';

/**
 * 課金訴求（10-pricing-b2b.md §2.4）。
 *
 * §2.4 の禁止事項に沿って、**モーダルで被せない**（M-A-03）。ページ内の1ブロックとして
 * 静かに置き、「あとで」で消せる。プッシュ通知には出さない（M-A-05）。
 * 揺れイベントの当日には出さない（M-A-04）— 呼び出し側がタイミングを保証する。
 */
export function ProUpsell({ route, headline, body }: { route: string; headline: string; body: string }) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    track('paywall_shown', { route });
  }, [route]);

  if (dismissed) return null;

  return (
    <div className="bg-white rounded-2xl border border-border shadow-sm p-5">
      <p className="text-sm font-semibold text-foreground mb-1">{headline}</p>
      <p className="text-xs text-muted-foreground leading-relaxed mb-4">{body}</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setDismissed(true);
            track('paywall_dismissed', { route });
          }}
          className="flex-1 py-2.5 rounded-xl border border-border text-xs font-semibold text-muted-foreground"
        >
          あとで
        </button>
        <Link
          href="/pricing"
          className="flex-1 py-2.5 rounded-xl bg-accent text-white text-xs font-semibold text-center"
        >
          Proを見る
        </Link>
      </div>
    </div>
  );
}
