import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';
import { SITE_URL } from '@/lib/utils';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'ココロバランス | 心の資産を分散しよう',
  description: '自分の心が何によって支えられているかを可視化し、依存の偏りを防ぎ、長期的に心を安定させる自己マネジメントアプリ',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={geist.variable}>
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
