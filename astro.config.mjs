// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import icon from 'astro-icon';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

// https://astro.build/config
// Preview deploys live under a sub-path (the preview repo name) on the same
// music-sustech.github.io host. Prod lives at the root. Pass BASE_PATH at
// build time (see .github/workflows/preview.yml) to drive this.
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  site: 'https://music-sustech.github.io',
  base,
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
