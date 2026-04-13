import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const publications = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/publications' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      authors: z.array(z.string()).min(1),
      year: z.number().int().gte(2000).lte(2100),
      venue: z.string().optional(),
      venueType: z.enum(['journal', 'conference', 'workshop', 'preprint', 'thesis', 'patent']),
      doi: z.string().optional(),
      arxiv: z.string().optional(),
      pdf: z.string().optional(),
      bibtex: z.string().optional(),
      abstract: z.string().optional(),
      thumbnail: image().optional(),
      featured: z.boolean().default(false),
      tags: z.array(z.string()).default([]),
      bibKey: z.string(),
      note: z.string().optional(),
      sortKey: z.string().optional(),
      patent: z.string().optional(),
    }),
});

const people = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/people' }),
  schema: ({ image }) =>
    z.object({
      name: z.string(),
      role: z.enum(['pi', 'postdoc', 'phd', 'masters', 'undergrad', 'visiting', 'staff']),
      status: z.enum(['current', 'alumni']),
      photo: image().optional(),
      email: z.string().email().optional(),
      showEmail: z.boolean().default(false),
      scholar: z.string().url().optional(),
      github: z.string().optional(),
      linkedin: z.string().url().optional(),
      joined: z.string(),
      left: z.string().optional(),
      currentPosition: z.string().optional(),
      bio: z.string().optional(),
    }),
});

const news = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/news' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    pinned: z.boolean().default(false),
  }),
});

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    author: z.string(),
    tags: z.array(z.string()).default([]),
    excerpt: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

const research = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/research' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      order: z.number().int().default(100),
      hero: image().optional(),
      shortDescription: z.string(),
    }),
});

const teaching = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/teaching' }),
  schema: z.object({
    title: z.string(),
    courseCode: z.string(),
    description: z.string(),
    currentlyOffered: z.boolean().default(false),
    offerings: z
      .array(
        z.object({
          semester: z.string(),
          year: z.number().int(),
          syllabusUrl: z.string().optional(),
          notes: z.string().optional(),
        })
      )
      .default([]),
  }),
});

export const collections = {
  publications,
  people,
  news,
  blog,
  research,
  teaching,
};
