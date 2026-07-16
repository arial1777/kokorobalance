import Link from 'next/link';
import type { BlogPostSummary } from '@/lib/blog-utils';

export function PostCard({ post }: { post: BlogPostSummary }) {
  const { slug, frontmatter, readingTime } = post;

  return (
    <Link
      href={`/blog/${slug}`}
      className="block bg-card border border-border rounded-2xl p-5 md:p-6 shadow-sm hover:shadow-md transition"
    >
      <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
        <time dateTime={frontmatter.date}>{frontmatter.date}</time>
        {frontmatter.category && (
          <span className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
            {frontmatter.category}
          </span>
        )}
        <span>{readingTime}分</span>
      </div>
      <h2 className="text-lg font-bold text-foreground mb-1.5 leading-snug">{frontmatter.title}</h2>
      <p className="text-sm text-muted-foreground leading-relaxed">{frontmatter.description}</p>
    </Link>
  );
}
