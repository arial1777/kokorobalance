import Link from 'next/link';
import type { BlogPost } from '@/lib/blog';

export function RelatedPosts({ posts }: { posts: BlogPost[] }) {
  if (posts.length === 0) return null;

  return (
    <div className="not-prose mt-10">
      <p className="font-bold text-foreground mb-3">あわせて読みたい</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {posts.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="block bg-card border border-border rounded-2xl p-4 hover:shadow-md transition"
          >
            {post.frontmatter.category && (
              <span className="text-xs text-muted-foreground">{post.frontmatter.category}</span>
            )}
            <p className="text-sm font-bold text-foreground leading-snug mt-1">{post.frontmatter.title}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
