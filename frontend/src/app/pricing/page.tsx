import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/utils';
import { PricingClient } from './pricing-client';

const TITLE = '料金プラン | ココロバランス';
const DESCRIPTION =
  'ココロバランスの料金プランをご紹介。無料プランでも心のポートフォリオや週間レポートなど基本機能が使えます。Proプラン（月額330円）ではAIコーチが無制限に。';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/pricing` },
  openGraph: {
    type: 'website',
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE_URL}/pricing`,
  },
};

export default function PricingPage() {
  return <PricingClient />;
}
