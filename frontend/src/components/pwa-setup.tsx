'use client';

import { useEffect, useState } from 'react';
import { Icon } from '@/components/ui/icon';

const DISMISS_KEY = 'kokorobalance-ios-banner-dismissed';

function isIosSafariNotInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent;
  const isIos = /iPhone|iPad|iPod/.test(ua);
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return isIos && !isStandalone;
}

/**
 * サービスワーカー登録と、iOS Safari向け「ホーム画面に追加」案内バナー。
 * iOSのWeb Pushはホーム画面追加が前提のため、まず追加を促す（v2 §6）。
 */
export function PwaSetup() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    if (isIosSafariNotInstalled() && !localStorage.getItem(DISMISS_KEY)) {
      setShowBanner(true);
    }
  }, []);

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-[76px] left-3 right-3 z-40 md:hidden">
      <div className="bg-[#1A3352] text-white rounded-2xl shadow-lg p-4 flex items-start gap-3">
        <Icon name="ios_share" className="text-xl mt-0.5 flex-shrink-0" />
        <p className="text-xs leading-relaxed flex-1">
          共有ボタン →「ホーム画面に追加」でアプリのように使えます。毎日の記録がぐっとラクになります。
        </p>
        <button
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, '1');
            setShowBanner(false);
          }}
          aria-label="閉じる"
          className="text-white/60 hover:text-white transition flex-shrink-0"
        >
          <Icon name="close" className="text-lg" />
        </button>
      </div>
    </div>
  );
}
