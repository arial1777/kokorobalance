import { notFound } from 'next/navigation';
import { MDXRemote } from 'next-mdx-remote/rsc';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import type { Metadata } from 'next';
import { getAllPosts, getPostBySlug, getReadingTime, getRelatedPosts, extractHeadings } from '@/lib/blog';
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

  const { title, description, date, updatedDate, ogImage, tags } = post.frontmatter;
  const url = `${SITE_URL}/blog/${slug}`;
  // Omit `images` entirely (rather than passing undefined) when no explicit ogImage is set,
  // so Next falls back to the file-based opengraph-image.tsx convention for this route.
  const images = ogImage ? [ogImage] : undefined;

  return {
    title: `${title} | ココロバランス`,
    description,
    keywords: tags,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      title,
      description,
      url,
      publishedTime: date,
      modifiedTime: updatedDate ?? date,
      ...(images && { images }),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(images && { images }),
    },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const { title, description, date, updatedDate, ogImage, faqs = [], tags, category } = post.frontmatter;
  const url = `${SITE_URL}/blog/${slug}`;
  const readingTime = getReadingTime(post.content);
  const headings = extractHeadings(post.content);
  const relatedPosts = getRelatedPosts(post, getAllPosts());

  const publisher = {
    '@type': 'Organization',
    name: 'ココロバランス',
    logo: { '@type': 'ImageObject', url: `${SITE_URL}/icon-512.png` },
  };

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    datePublished: date,
    dateModified: updatedDate ?? date,
    image: [ogImage ?? `${url}/opengraph-image`],
    author: { '@type': 'Organization', name: 'ココロバランス', url: SITE_URL },
    publisher,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    inLanguage: 'ja',
    ...(tags && tags.length > 0 && { keywords: tags.join(', ') }),
    ...(category && { articleSection: category }),
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'ホーム', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'ブログ', item: `${SITE_URL}/blog` },
      { '@type': 'ListItem', position: 3, name: title, item: url },
    ],
  };

  const faqJsonLd = faqs.length
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqs.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: { '@type': 'Answer', text: faq.answer },
        })),
      }
    : null;

  return (
    <div className="min-h-screen bg-background pb-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}
      <BlogHeader />
      <div className="max-w-3xl mx-auto px-4 md:px-8 pt-6 pb-8">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <time dateTime={date}>{date}</time>
          <span aria-hidden="true">・</span>
          <span>{readingTime}分で読めます</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground mt-2">{title}</h1>
      </div>
      <ArticleLayout headings={headings} faqs={faqs} relatedPosts={relatedPosts}>
        <MDXRemote
          source={post.content}
          components={mdxComponents}
          options={{
            mdxOptions: { remarkPlugins: [remarkGfm], rehypePlugins: [rehypeSlug] },
            // Content is first-party authored (content/blog/*.mdx), not user-submitted,
            // so JSX prop expressions like `steps={[...]}` are safe to evaluate.
            blockJS: false,
          }}
        />
      </ArticleLayout>
    </div>
  );
}
