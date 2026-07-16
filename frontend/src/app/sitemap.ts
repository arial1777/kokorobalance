import type { MetadataRoute } from 'next';
import { execSync } from 'child_process';
import { getAllCategories, getAllPosts } from '@/lib/blog';
import { SITE_URL } from '@/lib/utils';

/** Real last-modified signal from git history, not a fabricated build timestamp (which would falsely tell crawlers every static page changed on every deploy). */
function lastCommitDate(relativePath: string): Date | undefined {
  try {
    const output = execSync(`git log -1 --format=%cI -- "${relativePath}"`, {
      cwd: process.cwd(),
    })
      .toString()
      .trim();
    return output ? new Date(output) : undefined;
  } catch {
    return undefined;
  }
}

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getAllPosts();
  const latestPostDate = posts.reduce<string | undefined>((latest, post) => {
    const date = post.frontmatter.updatedDate ?? post.frontmatter.date;
    return !latest || date > latest ? date : latest;
  }, undefined);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: 'monthly', priority: 1, lastModified: lastCommitDate('src/app/page.tsx') },
    { url: `${SITE_URL}/blog`, changeFrequency: 'weekly', priority: 0.8, lastModified: latestPostDate },
    {
      url: `${SITE_URL}/pricing`,
      changeFrequency: 'monthly',
      priority: 0.6,
      lastModified: lastCommitDate('src/app/pricing/page.tsx'),
    },
    {
      url: `${SITE_URL}/privacy`,
      changeFrequency: 'yearly',
      priority: 0.2,
      lastModified: lastCommitDate('src/app/privacy/page.tsx'),
    },
    {
      url: `${SITE_URL}/terms`,
      changeFrequency: 'yearly',
      priority: 0.2,
      lastModified: lastCommitDate('src/app/terms/page.tsx'),
    },
    {
      url: `${SITE_URL}/support-resources`,
      changeFrequency: 'yearly',
      priority: 0.3,
      lastModified: lastCommitDate('src/app/support-resources/page.tsx'),
    },
  ];

  const postRoutes: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${SITE_URL}/blog/${post.slug}`,
    lastModified: post.frontmatter.updatedDate ?? post.frontmatter.date,
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  const categoryRoutes: MetadataRoute.Sitemap = getAllCategories().map((category) => ({
    url: `${SITE_URL}/blog/category/${encodeURIComponent(category)}`,
    changeFrequency: 'weekly',
    priority: 0.5,
  }));

  return [...staticRoutes, ...postRoutes, ...categoryRoutes];
}
