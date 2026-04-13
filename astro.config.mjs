// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import icon from 'astro-icon';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

// https://astro.build/config
export default defineConfig({
  site: 'https://music-sustech.github.io',
  output: 'static',
  vite: {
    plugins: [
      tailwindcss(),
      {
        // Astro's dev server doesn't auto-resolve /admin/ to the nested
        // public/admin/index.html. Prod build is fine; this rewrite only
        // applies in dev.
        name: 'admin-index-rewrite',
        configureServer(server) {
          server.middlewares.use((req, _res, next) => {
            if (req.url === '/admin' || req.url === '/admin/') {
              req.url = '/admin/index.html';
            }
            next();
          });
        },
      },
    ],
  },
  integrations: [
    sitemap(),
    icon({
      include: {
        lucide: [
          'menu',
          'x',
          'chevron-down',
          'chevron-up',
          'sun',
          'moon',
          'mail',
          'file-text',
          'external-link',
          'search',
        ],
      },
    }),
  ],
  markdown: {
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeKatex],
  },
});
