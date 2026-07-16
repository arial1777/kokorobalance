'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Icon } from '@/components/ui/icon';
import { PostCard } from './post-card';
import type { BlogPostSummary } from '@/lib/blog-utils';

const ALL_CATEGORY = 'すべて';

export function BlogSearch({ posts }: { posts: BlogPostSummary[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(() => searchParams.get('q') ?? '');
  const [activeCategory, setActiveCategory] = useState(() => searchParams.get('category') ?? ALL_CATEGORY);

  // Keeps the search/filter state shareable and restorable via back/forward, without adding a history entry per keystroke.
  useEffect(() => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (activeCategory !== ALL_CATEGORY) params.set('category', activeCategory);
    const queryString = params.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
  }, [query, activeCategory, pathname, router]);

  const categories = useMemo(() => {
    const set = new Set(posts.map((post) => post.frontmatter.category).filter(Boolean) as string[]);
    return [ALL_CATEGORY, ...Array.from(set)];
  }, [posts]);

  const filteredPosts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return posts.filter((post) => {
      const { frontmatter } = post;
      const matchesCategory = activeCategory === ALL_CATEGORY || frontmatter.category === activeCategory;
      if (!matchesCategory) return false;
      if (!normalizedQuery) return true;

      const haystack = [frontmatter.title, frontmatter.description, ...(frontmatter.tags ?? [])]
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [posts, query, activeCategory]);

  return (
    <div>
      <div className="relative mb-4">
        <Icon
          name="search"
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg text-muted-foreground"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="記事を検索"
          className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="検索をクリア"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <Icon name="close" className="text-lg" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            aria-pressed={activeCategory === category}
            onClick={() => setActiveCategory(category)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
              activeCategory === category
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-muted'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {filteredPosts.length === 0 ? (
        <p className="text-sm text-muted-foreground">条件に一致する記事が見つかりませんでした。</p>
      ) : (
        <div className="space-y-4">
          {filteredPosts.map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
