'use client';

import { useEffect, useState } from 'react';
import { Icon } from '@/components/ui/icon';

/** Brand marks aren't in Material Symbols, so each service ships its own inline path. */
const BRAND_ICONS = {
  x: (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="w-[18px] h-[18px] fill-current">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  ),
  line: (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="w-[19px] h-[19px] fill-current">
      <path d="M12 2C6.201 2 1.5 5.79 1.5 10.463c0 4.188 3.727 7.695 8.762 8.359.341.073.806.225.923.516.106.264.069.677.034.945l-.149.897c-.046.264-.211 1.035.907.564 1.118-.47 6.033-3.552 8.23-6.081C21.66 13.998 22.5 12.337 22.5 10.463 22.5 5.79 17.799 2 12 2M7.677 13.21H5.59a.553.553 0 0 1-.553-.553V8.484a.553.553 0 0 1 1.106 0v3.62h1.534a.553.553 0 0 1 0 1.106m2.166-.553a.553.553 0 0 1-1.106 0V8.484a.553.553 0 0 1 1.106 0zm5.023 0a.553.553 0 0 1-.995.332l-2.139-2.913v2.581a.553.553 0 0 1-1.106 0V8.484a.553.553 0 0 1 .994-.333l2.14 2.913V8.484a.553.553 0 0 1 1.106 0zm3.373-2.639a.553.553 0 0 1 0 1.106h-1.534v.98h1.534a.553.553 0 0 1 0 1.106h-2.087a.553.553 0 0 1-.553-.553V8.484a.553.553 0 0 1 .553-.553h2.087a.553.553 0 0 1 0 1.106h-1.534v.981z" />
    </svg>
  ),
  facebook: (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="w-[19px] h-[19px] fill-current">
      <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.412c0-3.026 1.792-4.697 4.533-4.697 1.313 0 2.686.236 2.686.236v2.971H15.83c-1.491 0-1.956.931-1.956 1.886v2.265h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073" />
    </svg>
  ),
  hatena: (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="w-[18px] h-[18px] fill-current">
      <path d="M4.5 3h5.263c1.79 0 3.155.35 4.09 1.05.936.7 1.404 1.723 1.404 3.068 0 .94-.22 1.734-.66 2.383-.44.648-1.08 1.107-1.92 1.376 1.02.24 1.8.73 2.34 1.47.54.74.81 1.66.81 2.76 0 1.47-.51 2.61-1.53 3.42-1.02.81-2.46 1.215-4.32 1.215H4.5zm4.02 6.36h1.11c.66 0 1.155-.135 1.485-.405.33-.27.495-.66.495-1.17 0-.48-.165-.848-.495-1.103-.33-.255-.825-.382-1.485-.382H8.52zm0 7.14h1.44c.72 0 1.26-.15 1.62-.45.36-.3.54-.735.54-1.305 0-.55-.18-.968-.54-1.253-.36-.285-.9-.427-1.62-.427H8.52zM17.7 15.51c.72 0 1.32.247 1.8.742.48.495.72 1.103.72 1.823s-.24 1.32-.72 1.815c-.48.495-1.08.742-1.8.742s-1.32-.247-1.8-.742c-.48-.495-.72-1.095-.72-1.815s.24-1.328.72-1.823c.48-.495 1.08-.742 1.8-.742m1.98-12.51v9.9h-3.96V3z" />
    </svg>
  ),
} as const;

const SERVICES = [
  { key: 'x', label: 'Xでシェア', className: 'bg-[#000000] hover:bg-[#000000]/85' },
  { key: 'line', label: 'LINEでシェア', className: 'bg-[#06C755] hover:bg-[#06C755]/85' },
  { key: 'facebook', label: 'Facebookでシェア', className: 'bg-[#1877F2] hover:bg-[#1877F2]/85' },
  { key: 'hatena', label: 'はてなブックマークに追加', className: 'bg-[#00A4DE] hover:bg-[#00A4DE]/85' },
] as const;

function buildShareUrl(service: (typeof SERVICES)[number]['key'], url: string, title: string): string {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  switch (service) {
    case 'x':
      return `https://x.com/intent/post?text=${t}&url=${u}`;
    case 'line':
      return `https://social-plugins.line.me/lineit/share?url=${u}&text=${t}`;
    case 'facebook':
      return `https://www.facebook.com/sharer/sharer.php?u=${u}`;
    case 'hatena':
      return `https://b.hatena.ne.jp/entry/panel/?url=${u}&title=${t}`;
  }
}

export function ShareButtons({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  // navigator.share only exists on some clients, so detect after mount to keep SSR/CSR markup identical.
  const [canNativeShare, setCanNativeShare] = useState(false);

  useEffect(() => {
    setCanNativeShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);

  useEffect(() => {
    if (!copied && !copyFailed) return;
    const timer = setTimeout(() => {
      setCopied(false);
      setCopyFailed(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, [copied, copyFailed]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setCopyFailed(false);
    } catch {
      setCopyFailed(true);
      setCopied(false);
    }
  }

  async function nativeShare() {
    try {
      await navigator.share({ title, url });
    } catch {
      // AbortError when the user dismisses the sheet — nothing to report.
    }
  }

  return (
    <section className="not-prose mt-10" aria-labelledby="share-heading">
      <p id="share-heading" className="font-bold text-foreground mb-3 text-sm">
        この記事をシェア
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {SERVICES.map((service) => (
          <a
            key={service.key}
            href={buildShareUrl(service.key, url, title)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={service.label}
            title={service.label}
            className={`w-10 h-10 rounded-full flex items-center justify-center text-white transition shadow-sm ${service.className}`}
          >
            {BRAND_ICONS[service.key]}
          </a>
        ))}

        <button
          type="button"
          onClick={copyLink}
          aria-label="リンクをコピー"
          className="h-10 px-3.5 rounded-full border border-border bg-card text-foreground text-xs font-semibold flex items-center gap-1.5 hover:bg-secondary transition"
        >
          <Icon name={copied ? 'check' : 'link'} className="text-lg" />
          {copied ? 'コピーしました' : copyFailed ? 'コピーできません' : 'リンクをコピー'}
        </button>

        {canNativeShare && (
          <button
            type="button"
            onClick={nativeShare}
            aria-label="他のアプリでシェア"
            className="w-10 h-10 rounded-full border border-border bg-card text-foreground flex items-center justify-center hover:bg-secondary transition"
          >
            <Icon name="ios_share" className="text-lg" />
          </button>
        )}
      </div>
    </section>
  );
}
