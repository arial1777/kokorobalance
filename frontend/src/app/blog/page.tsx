import Link from 'next/link';
import { Suspense } from 'react';
import { getAllCategories, getAllPosts, toSummary } from '@/lib/blog';
import { BlogHeader } from '@/components/blog/blog-header';
import { BlogSearch } from '@/components/blog/blog-search';
import { SITE_URL } from '@/lib/utils';

export const metadata = {
  title: 'ブログ | ココロバランス',
  description:
    'メンタルヘルス・セルフケア・ストレス対処に関する記事をお届けします。心理学や行動科学の知見をもとに、今日から実践できるセルフケアのヒントを紹介します。',
  alternates: {
    canonical: `${SITE_URL}/blog`,
    types: { 'application/rss+xml': '/blog/feed.xml' },
  },
  openGraph: {
    type: 'website',
    title: 'ブログ | ココロバランス',
    description: 'メンタルヘルス・セルフケア・ストレス対処に関する記事をお届けします。',
    url: `${SITE_URL}/blog`,
  },
};

export default function BlogIndexPage() {
  const posts = getAllPosts();
  const categories = getAllCategories();

  const blogJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'ブログ | ココロバランス',
    description:
      'メンタルヘルス・セルフケア・ストレス対処に関する記事をお届けします。',
    url: `${SITE_URL}/blog`,
    blogPost: posts.map((post) => ({
      '@type': 'BlogPosting',
      headline: post.frontmatter.title,
      description: post.frontmatter.description,
      url: `${SITE_URL}/blog/${post.slug}`,
      datePublished: post.frontmatter.date,
      dateModified: post.frontmatter.updatedDate ?? post.frontmatter.date,
    })),
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {posts.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(blogJsonLd) }}
        />
      )}
      <BlogHeader />
      <div className="max-w-3xl mx-auto px-4 md:px-8 pt-6">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-8">ブログ</h1>
        {posts.length === 0 ? (
          <p className="text-sm text-muted-foreground">まだ記事がありません。</p>
        ) : (
          <>
            <Suspense fallback={null}>
              <BlogSearch posts={posts.map(toSummary)} />
            </Suspense>
            <div className="mt-10 pt-6 border-t border-border">
              <p className="text-sm font-bold text-foreground mb-3">カテゴリから探す</p>
              <div className="flex flex-wrap gap-2">
                {categories.map((category) => (
                  <Link
                    key={category}
                    href={`/blog/category/${encodeURIComponent(category)}`}
                    className="px-3 py-1.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground hover:bg-muted transition"
                  >
                    {category}
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
