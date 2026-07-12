import { getAllPosts } from '@/lib/blog';
import { SITE_URL } from '@/lib/utils';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function GET() {
  const posts = getAllPosts();

  const items = posts
    .map((post) => {
      const url = `${SITE_URL}/blog/${post.slug}`;
      const pubDate = new Date(post.frontmatter.date).toUTCString();
      return `    <item>
      <title>${escapeXml(post.frontmatter.title)}</title>
      <link>${url}</link>
      <guid>${url}</guid>
      <description>${escapeXml(post.frontmatter.description)}</description>
      <pubDate>${pubDate}</pubDate>
      ${post.frontmatter.category ? `<category>${escapeXml(post.frontmatter.category)}</category>` : ''}
    </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>ココロバランス ブログ</title>
    <link>${SITE_URL}/blog</link>
    <description>メンタルヘルス・セルフケアに関する記事をお届けします。</description>
    <language>ja</language>
    <atom:link xmlns:atom="http://www.w3.org/2005/Atom" href="${SITE_URL}/blog/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}
