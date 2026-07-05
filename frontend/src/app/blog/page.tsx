import { getAllPosts } from '@/lib/blog';
import { BlogHeader } from '@/components/blog/blog-header';
import { PostCard } from '@/components/blog/post-card';

export const metadata = {
  title: 'ブログ | ココロバランス',
  description: 'メンタルヘルス・セルフケアに関する記事をお届けします。',
};

export default function BlogIndexPage() {
  const posts = getAllPosts();

  return (
    <div className="min-h-screen bg-background pb-20">
      <BlogHeader />
      <div className="max-w-3xl mx-auto px-4 md:px-8 pt-6">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-8">ブログ</h1>
        {posts.length === 0 ? (
          <p className="text-sm text-muted-foreground">まだ記事がありません。</p>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <PostCard key={post.slug} post={post} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
