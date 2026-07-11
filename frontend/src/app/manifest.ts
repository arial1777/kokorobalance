import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ココロバランス',
    short_name: 'ココロバランス',
    description: '心の支えは、1本より3本。心のポートフォリオを可視化して、支えの柱を育てよう。',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#F7F5F0',
    theme_color: '#1A3352',
    lang: 'ja',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
