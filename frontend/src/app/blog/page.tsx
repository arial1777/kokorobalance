import Link from 'next/link';
import { getAllCategories, getAllPosts } from '@/lib/blog';
import { BlogHeader } from '@/components/blog/blog-header';
import { BlogSearch } from '@/components/blog/blog-search';

export const metadata = {
  title: 'ブログ | ココロバランス',
  description: 'メンタルヘルス・セルフケアに関する記事をお届けします。',
  alternates: {
    types: { 'application/rss+xml': '/blog/feed.xml' },
  },
};

export default function BlogIndexPage() {
  const posts = getAllPosts();
  const categories = getAllCategories();

  return (
    <div className="min-h-screen bg-background pb-20">
      <BlogHeader />
      <div className="max-w-3xl mx-auto px-4 md:px-8 pt-6">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-8">ブログ</h1>
        {posts.length === 0 ? (
          <p className="text-sm text-muted-foreground">まだ記事がありません。</p>
        ) : (
          <>
            <BlogSearch posts={posts} />
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
