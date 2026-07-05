import { notFound } from 'next/navigation';
import { MDXRemote } from 'next-mdx-remote/rsc';
import type { Metadata } from 'next';
import { getAllPosts, getPostBySlug } from '@/lib/blog';
import { SITE_URL } from '@/lib/utils';
import { BlogHeader } from '@/components/blog/blog-header';
import { ArticleLayout } from '@/components/blog/article-layout';
import { mdxComponents } from '@/components/blog/mdx-components';

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};

  const { title, description, date, updatedDate, ogImage } = post.frontmatter;
  const url = `${SITE_URL}/blog/${slug}`;
  const images = ogImage ? [ogImage] : undefined;

  return {
    title: `${title} | ココロバランス`,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      title,
      description,
      url,
      publishedTime: date,
      modifiedTime: updatedDate ?? date,
      images,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images,
    },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const { title, description, date, updatedDate, ogImage } = post.frontmatter;
  const url = `${SITE_URL}/blog/${slug}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    datePublished: date,
    dateModified: updatedDate ?? date,
    image: ogImage ? [ogImage] : undefined,
    author: { '@type': 'Organization', name: 'ココロバランス' },
    mainEntityOfPage: url,
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <BlogHeader />
      <div className="max-w-3xl mx-auto px-4 md:px-8 pt-6 pb-8">
        <time dateTime={date} className="text-xs text-muted-foreground">{date}</time>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground mt-2">{title}</h1>
      </div>
      <ArticleLayout>
        <MDXRemote source={post.content} components={mdxComponents} />
      </ArticleLayout>
    </div>
  );
}
