'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

/**
 * モバイル専用の固定ボトムCTA。診断セクション（#diagnosis-end センチネル）を
 * 通過したら表示する。診断stateには依存しない（常に/signupへ）。
 */
export function StickyCta() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const sentinel = document.getElementById('diagnosis-end');
    if (!sentinel || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          // センチネルが画面上方向へ抜けたら表示、戻ったら隠す
          setVisible(e.boundingClientRect.top < 0);
        }
      },
      { threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden animate-in slide-in-from-bottom-full duration-300">
      <div className="bg-white/95 backdrop-blur-sm border-t border-border px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Link
          href="/signup"
          className="flex items-center justify-center w-full py-3 bg-accent text-white font-bold rounded-xl hover:bg-[#c94d30] transition shadow-sm text-sm"
        >
          無料で本格診断をはじめる
        </Link>
      </div>
    </div>
  );
}
