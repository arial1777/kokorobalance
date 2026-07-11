// 最小サービスワーカー（インストール可能性のため）。
// オフラインキャッシュ・Web Pushはβ後に検討（web-implementation-plan.md WP8）。
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
  // ネットワークへ素通し
});
