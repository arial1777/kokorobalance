import GithubSlugger from 'github-slugger'

export interface PostSource {
  label: string
  url: string
}

export interface PostFaq {
  question: string
  answer: string
}

export interface PostFrontmatter {
  title: string
  description: string
  date: string
  updatedDate?: string
  category?: string
  tags?: string[]
  ogImage?: string
  draft?: boolean
  sources?: PostSource[]
  faqs?: PostFaq[]
}

export interface BlogPost {
  slug: string
  frontmatter: PostFrontmatter
  content: string
}

/** Listing-page card data, without the raw MDX body — keeps client-component payloads (e.g. search) from carrying every post's full content. */
export interface BlogPostSummary {
  slug: string
  frontmatter: PostFrontmatter
  readingTime: number
}

export interface Heading {
  depth: 2 | 3
  text: string
  id: string
}

/** Japanese silent-reading speed is commonly estimated at ~500-600 chars/min; 500 keeps estimates conservative (round up). */
const JA_CHARS_PER_MINUTE = 500

export function getReadingTime(content: string): number {
  const plain = content
    .replace(/```[\s\S]*?```/g, '')
    .replace(/[#>*_`~-]/g, '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, '')
  return Math.max(1, Math.ceil(plain.length / JA_CHARS_PER_MINUTE))
}

export function toSummary(post: BlogPost): BlogPostSummary {
  return { slug: post.slug, frontmatter: post.frontmatter, readingTime: getReadingTime(post.content) }
}

function stripMarkdownInline(text: string): string {
  return text
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`]/g, '')
    .trim()
}

/**
 * Mirrors rehype-slug's id generation (same github-slugger, reset per document)
 * so TOC links match the anchor ids actually rendered on the page.
 */
export function extractHeadings(content: string): Heading[] {
  const slugger = new GithubSlugger()
  const headings: Heading[] = []
  const lines = content.split('\n')
  const inCodeFence = /^```/

  let fenced = false
  for (const line of lines) {
    if (inCodeFence.test(line)) {
      fenced = !fenced
      continue
    }
    if (fenced) continue

    const match = /^(#{2,3})\s+(.*)$/.exec(line)
    if (!match) continue

    const depth = match[1].length as 2 | 3
    const text = stripMarkdownInline(match[2])
    headings.push({ depth, text, id: slugger.slug(text) })
  }

  return headings
}

export function getRelatedPosts(post: BlogPost, allPosts: BlogPost[], limit = 3): BlogPost[] {
  const tags = new Set(post.frontmatter.tags ?? [])
  const category = post.frontmatter.category

  return allPosts
    .filter((candidate) => candidate.slug !== post.slug)
    .map((candidate) => {
      const sharedTags = (candidate.frontmatter.tags ?? []).filter((tag) => tags.has(tag)).length
      const sameCategory = candidate.frontmatter.category === category ? 1 : 0
      return { candidate, score: sharedTags * 2 + sameCategory }
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || (a.candidate.frontmatter.date < b.candidate.frontmatter.date ? 1 : -1))
    .slice(0, limit)
    .map(({ candidate }) => candidate)
}
