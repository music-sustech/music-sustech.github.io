import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context) {
  const [allNews, allBlog] = await Promise.all([
    getCollection('news'),
    getCollection('blog'),
  ]);

  // Filter out drafts from blog
  const publishedBlog = allBlog.filter((post) => !post.data.draft);

  // Combine and sort by date descending
  const items = [
    ...allNews.map((item) => ({
      title: item.data.title,
      pubDate: item.data.date,
      link: `/updates/news/${item.id}/`,
    })),
    ...publishedBlog.map((post) => ({
      title: post.data.title,
      pubDate: post.data.date,
      description: post.data.excerpt ?? '',
      link: `/updates/blog/${post.id}/`,
    })),
  ].sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());

  return rss({
    title: 'MUSIC Lab',
    description: 'News and blog posts from the MUSIC Lab at SUSTech.',
    site: context.site,
    items,
  });
}
