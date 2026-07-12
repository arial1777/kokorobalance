'use client';

import { useMemo, useState } from 'react';
import { Icon } from '@/components/ui/icon';
import { PostCard } from './post-card';
import type { BlogPost } from '@/lib/blog-utils';

const ALL_CATEGORY = 'すべて';

export function BlogSearch({ posts }: { posts: BlogPost[] }) {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState(ALL_CATEGORY);

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
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {categories.map((category) => (
          <button
            key={category}
            type="button"
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
