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

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'ココロバランス | 心の支えは、1本より3本。',
  description:
    '自分の心が何によって支えられているかを可視化し、心の柱を育てて長期的に心を安定させるセルフケア支援アプリ',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={`${geist.variable} ${notoSansJP.variable}`}>
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0..1,0"
        />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased font-[var(--font-noto),var(--font-geist),sans-serif]">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
