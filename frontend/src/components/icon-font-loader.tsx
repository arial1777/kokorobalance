'use client';

import { useEffect } from 'react';

/**
 * Injects the icon font stylesheet after mount instead of a render-blocking <link> in <head>.
 * Lighthouse measured this single synchronous Google Fonts request as costing 3.2-5.4s of
 * render-blocking time on kokorobalance.app (mobile, simulated 4G) — this removes it from the
 * critical rendering path. The <noscript> fallback in the layout keeps icons working without JS.
 */
export function IconFontLoader({ href }: { href: string }) {
  useEffect(() => {
    if (document.querySelector(`link[href="${href}"]`)) return;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }, [href]);

  return null;
}
