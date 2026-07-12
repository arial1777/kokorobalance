import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getAllCategories, getPostsByCategory } from '@/lib/blog';
import { SITE_URL } from '@/lib/utils';
import { BlogHeader } from '@/components/blog/blog-header';
import { PostCard } from '@/components/blog/post-card';

type Params = { category: string };

export function generateStaticParams(): Params[] {
  return getAllCategories().map((category) => ({ category }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { category: rawCategory } = await params;
  const category = decodeURIComponent(rawCategory);
  const posts = getPostsByCategory(category);
  if (posts.length === 0) return {};

  const title = `「${category}」の記事一覧 | ブログ | ココロバランス`;
  const description = `メンタルヘルス・セルフケアに関する「${category}」カテゴリの記事一覧です。`;
  const url = `${SITE_URL}/blog/category/${encodeURIComponent(category)}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: 'website', title, description, url },
  };
}

export default async function CategoryPage({ params }: { params: Promise<Params> }) {
  const { category: rawCategory } = await params;
  const category = decodeURIComponent(rawCategory);
  const posts = getPostsByCategory(category);
  if (posts.length === 0) notFound();

  const url = `${SITE_URL}/blog/category/${encodeURIComponent(category)}`;
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'ホーム', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'ブログ', item: `${SITE_URL}/blog` },
      { '@type': 'ListItem', position: 3, name: category, item: url },
    ],
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <BlogHeader />
      <div className="max-w-3xl mx-auto px-4 md:px-8 pt-6">
        <Link href="/blog" className="text-sm text-muted-foreground hover:text-foreground font-medium">
          ← ブログ一覧
        </Link>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground mt-3 mb-8">
          「{category}」の記事一覧
        </h1>
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </div>
      </div>
    </div>
  );
}
