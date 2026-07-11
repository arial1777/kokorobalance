'use client';

import { useEffect, useRef, useState } from 'react';

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
}

/**
 * スクロールリビール。初期状態は表示（JS無効・reduced-motionでもコンテンツが見える）で、
 * マウント後にIntersectionObserverが使える環境でのみ非表示→交差時にアニメ表示へ切り替える。
 * childrenはpropsで受けるため、包んだセクションはサーバーレンダリングのまま。
 */
export function Reveal({ children, className, delayMs = 0 }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'initial' | 'hidden' | 'shown'>('initial');

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (
      typeof IntersectionObserver === 'undefined' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return; // そのまま表示
    }
    // すでにビューポート内なら隠さない（ファーストビューのフリッカー防止）
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.9) return;

    setState('hidden');
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setState('shown');
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`${className ?? ''} ${
        state === 'hidden'
          ? 'opacity-0'
          : state === 'shown'
            ? 'animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both'
            : ''
      }`}
      style={state === 'shown' && delayMs ? { animationDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </div>
  );
}
