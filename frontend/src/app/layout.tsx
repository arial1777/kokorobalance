import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import { Noto_Sans_JP } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';
import { SITE_URL } from '@/lib/utils';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' });
const notoSansJP = Noto_Sans_JP({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-noto',
  display: 'swap',
});

const SITE_TITLE = 'ココロバランス | 心の支えは、1本より3本。';
const SITE_DESCRIPTION =
  '自分の心が何によって支えられているかを可視化し、心の柱を育てて長期的に心を安定させるセルフケア支援アプリ';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  openGraph: {
    type: 'website',
    siteName: 'ココロバランス',
    locale: 'ja_JP',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
};

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'ココロバランス',
  url: SITE_URL,
  logo: `${SITE_URL}/icon-512.png`,
};

const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'ココロバランス',
  url: SITE_URL,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={`${geist.variable} ${notoSansJP.variable}`}>
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0..1,0"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased font-[var(--font-noto),var(--font-geist),sans-serif]">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
