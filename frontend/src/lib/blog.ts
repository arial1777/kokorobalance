import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import type { BlogPost, PostFrontmatter } from './blog-utils'

export * from './blog-utils'

const BLOG_DIR = path.join(process.cwd(), 'content/blog')

export function getAllSlugs(): string[] {
  return fs
    .readdirSync(BLOG_DIR)
    .filter((file) => file.endsWith('.mdx'))
    .map((file) => file.replace(/\.mdx$/, ''))
}

export function getPostBySlug(slug: string): BlogPost | null {
  const filePath = path.join(BLOG_DIR, `${slug}.mdx`)
  if (!fs.existsSync(filePath)) return null

  const raw = fs.readFileSync(filePath, 'utf8')
  const { data, content } = matter(raw)
  const frontmatter = data as PostFrontmatter

  if (frontmatter.draft) return null

  return { slug, frontmatter, content }
}

export function getAllPosts(): BlogPost[] {
  return getAllSlugs()
    .map((slug) => getPostBySlug(slug))
    .filter((post): post is BlogPost => post !== null)
    .sort((a, b) => (a.frontmatter.date < b.frontmatter.date ? 1 : -1))
}

export function getAllCategories(): string[] {
  const categories = new Set(
    getAllPosts()
      .map((post) => post.frontmatter.category)
      .filter((category): category is string => Boolean(category)),
  )
  return Array.from(categories).sort()
}

export function getPostsByCategory(category: string): BlogPost[] {
  return getAllPosts().filter((post) => post.frontmatter.category === category)
}
