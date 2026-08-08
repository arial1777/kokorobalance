import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/utils';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      /**
       * ここに載せるのは「クローラーが必ずリダイレクトを踏むURL」だけ。
       * リダイレクトするURLは meta robots を読ませようがないので、クロール自体を止めるしかない
       * (放置すると Search Console の「ページにリダイレクトがあります」に積み上がる)。
       * 200 を返すのに索引したくないページ (/login, /signup, /pricing/success) は逆に
       * ここでブロックせず、noindex メタタグを読ませて外す。
       */
      disallow: [
        '/dashboard',
        '/record',
        '/portfolio',
        '/report',
        '/coach',
        '/settings',
        '/onboarding',
        '/auth/',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
