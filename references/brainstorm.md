# MUSIC Lab website refresh — brainstorm

*Source: `github.com/music-sustech/music-sustech.github.io`, live at `https://music-sustech.github.io`*
*Opened: 2026-04-11*

---

## TL;DR

- The site is not just stale, **parts of it are broken**: Bootstrap 3 CSS is loaded over HTTP on an HTTPS page (mixed-content, blocked by every modern browser), jQuery is double-loaded at two different versions, Google Analytics has been collecting nothing for ~10 years (`ga.js` endpoint + a `UA-` tracker), and the favicon and one JS file still point at the previous lab's `ucdart.github.io`.
- Server-side Jekyll plug-in surface is tiny (`jekyll-feed`, `jekyll-sitemap`) — the real risk surface is **client-side**, and it's all unmaintained jQuery-era stuff.
- Content asymmetry is the editorial pain point: **200 files in `_publication/`** vs a **single hand-edited `people/index.md`** vs **news frozen since April 2019**. The CMS question is not cosmetic; it's the reason the site stopped being updated.
- Target stack (locked in): **GH Actions → Pages deploy**, **Astro + content collections**, **Sveltia CMS** at `/admin/` with a **Deno Deploy OAuth broker** (CF Workers kept as a swap-in alternate). Same `music-sustech.github.io` URL, same push-to-deploy convenience, modern everything else.
- Migration is real work but not enormous — most of it is writing a Node script to transform the 200 publication markdowns and rebuilding the hand-rolled layout as Astro components.

---

## 1. Verified current state

### 1.1 Build pipeline

- Default GitHub Pages build (no custom deploy workflow). The *only* GH Actions workflow in the repo is `codeql-analysis.yml`, and CodeQL on a Jekyll site with almost no hand-written JS is mostly theater — it'll scan the one or two local JS files and not the CDN-loaded ones that actually matter.
- `Gemfile.lock` pins `jekyll 3.7.4`, `github-pages 193`, `bundler 1.16.4`. Upstream Jekyll is 4.x; `github-pages` gem is well past 193; Bundler 1.x is EoL. The lockfile has not been touched in years.
- Last meaningful commit: **2021-12-30**. News content stops ~2.5 years earlier, at April 2019.

### 1.2 Server-side plug-ins

From `_config.yml` (verbatim):

```yaml
plugins:
  - jekyll-feed
  - jekyll-sitemap
collections:
  publication:
    output: true
  blog:
    output: true
```

- Both plug-ins are on the GitHub Pages allowlist. No custom gems. No `jekyll-scholar` or similar academic plug-ins — publications are manually maintained markdown with hand-written front matter.
- The `github-pages` meta-gem transitively pulls in `kramdown`, `nokogiri`, `liquid`, `sass`, `rouge`, etc. Most have had CVEs at some point (nokogiri and kramdown especially). Because the lockfile is frozen at `github-pages 193`, whatever transitive versions were current in ~2020 are what Bundler resolves — though on the default GH Pages build, the server actually ignores the lockfile and uses whatever `github-pages` version GitHub runs.

### 1.3 Client-side assets — the real risk surface

From `_layouts/default.html` (verbatim excerpt):

```html
<link rel="shortcut icon" href="/ucdart.ico">
<link rel="stylesheet" href="http://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/css/bootstrap.min.css">
<script src="https://ajax.googleapis.com/ajax/libs/jquery/3.3.1/jquery.min.js"></script>
<script src="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/js/bootstrap.min.js"></script>
<script src="https://use.fontawesome.com/b2e828500b.js"></script>
<script src="//code.jquery.com/jquery-2.1.4.min.js"></script>
<script src="//cdn.jsdelivr.net/velocity/1.2.3/velocity.min.js"></script>
<script src="/javascripts/unslider-min.js"></script>
...
<script src="https://ucdart.github.io/javascripts/scale.fix.js"></script>
<script type="text/javascript">
  var gaJsHost = (("https:" == document.location.protocol) ? "https://ssl." : "http://www.");
  document.write(unescape("%3Cscript src='" + gaJsHost + "google-analytics.com/ga.js' type='text/javascript'%3E%3C/script%3E"));
</script>
<script type="text/javascript">
  try { var pageTracker = _gat._getTracker("UA-58268327-1"); pageTracker._trackPageview(); } catch(err) {}
</script>
```

Findings from that block alone:

1. **Bootstrap 3 CSS is loaded via `http://`** on a page served over `https://github.io`. Every current browser blocks this as mixed active/passive content. Bootstrap 3 styles are **not applying** in normal browser sessions. What you see rendered is the hand-rolled `/stylesheets/styles.css` carrying the site by itself. (Bootstrap 3 JS is https, so it loads — a carousel built on jQuery, Bootstrap 3, Velocity, and Unslider is stuck in 2015.)
2. **Bootstrap 3 itself is EoL** (July 2019, no security fixes). The `maxcdn.bootstrapcdn.com` CDN was deprecated/sunset in 2023.
3. **jQuery is double-loaded**: 3.3.1 via googleapis, then 2.1.4 via `code.jquery.com`. The second load clobbers the first. Known CVEs in this range include prototype-pollution (jQuery <3.4.0) and HTML-parser XSS (jQuery <3.5.0) — both affect 3.3.1, and 2.1.4 is worse on every axis.
4. **FontAwesome kit `b2e828500b.js`** is a pre-FA5 `use.fontawesome.com/...js` kit URL. That delivery method was deprecated; FA5+ uses account-bound kits under `kit.fontawesome.com`. This kit may still load, but icon set is frozen at FA4.
5. **Velocity.js 1.2.3** from jsdelivr — library has been unmaintained since ~2018.
6. **`unslider-min.js`** is a small unmaintained jQuery slider. The whole carousel should be replaced.
7. **MathJax** is pulled in conditionally via `{% include mathjax_support %}`. I could not fetch that include at `_includes/mathjax_support.html` (404), so the version isn't yet confirmed from evidence — but in a pre-2022 Jekyll template loading a "mathjax support" include, it's almost certainly **MathJax v2**, which is in maintenance-only mode and has had a number of XSS-adjacent advisories over the years. Target replacement is **KaTeX at build time** (no runtime JS required).
8. **Google Analytics block is a fossil layer**: the `ga.js` loader pattern + `_gat._getTracker("UA-XXXX")` call is **GA Classic**, retired in 2016 and superseded first by `analytics.js` (Universal Analytics, also dead since July 2023) and then by `gtag.js` (GA4). The `UA-58268327-1` property almost certainly stopped collecting when Google shut off `ga.js` endpoints, meaning the lab has had **zero meaningful analytics for approximately a decade**.
9. **Two leftover references to the previous lab identity** (UC Davis DART lab): `<link rel="shortcut icon" href="/ucdart.ico">` (file does not appear to exist in the repo — 404s) and `<script src="https://ucdart.github.io/javascripts/scale.fix.js">` (loaded from a different github-pages site every pageview).
10. The `<meta viewport>` is present, but there's no CSS container strategy, the navigation is a hand-rolled `<p class="view">` with pipe-separated `<a>` tags (no `<nav>`, no ARIA), and the only responsive behavior comes from the broken Bootstrap layer. **The site is not genuinely responsive today.**

### 1.4 Content shape

| Collection/dir | Count | Notes |
|---|---|---|
| `_publication/*.md` | **~100 md + ~100 pdf** (200 files) | Filename convention `{first_author_initials+year}[letter].md` — legacy from UC Davis era. Many papers predate SUSTech. |
| `_posts/*.md` | **15** | Last dated 2019-04-10 (`Xiaomeng-YP-Paper.md`). Several filenames reference `DART-lab` rather than MUSIC. One is literally `...- Copy.md`. |
| `people/` | **1 index.md + openings + 2 postdoc pages** | **Single monolithic markdown for all members.** This is the #1 editorial pain point. Every student join/graduation is a commit to one big file. |
| `research/`, `education/`, `facilities/`, `resources/` | n/a | Mostly static pages, some subpages. Need per-dir inventory in Phase 1. |
| `uav/`, `utilities/` | ~11 files | **Deleted per §6**, except `uav/uav.png` preserved as an image asset. UAV page is a 2015 DART-era senior design artifact (nav link already commented out). `utilities/` is obsolete Jekyll build scripts plus committed `.pyc`/`.bak` cruft. |

### 1.5 Analytics & monitoring

- GA: dead (see 1.3).
- No privacy banner (none needed today, because nothing is tracking).
- No error monitoring (Sentry etc. — and for a static site that's fine).
- No uptime monitoring against `music-sustech.github.io`.

### 1.6 Security posture

- `codeql-analysis.yml` present; scans JS/Python. Low value for this repo.
- **Dependabot**: status unknown; need to confirm in Phase 1. Recommend enabling for `bundler`, and after migration for `npm` and `github-actions`.
- No `SECURITY.md` content verified (a file exists; contents not inspected).
- No branch protection rule confirmed.
- No CSP header (can add via `<meta>` element once we know the target asset origins).
- Mixed-content Bootstrap CSS is a quiet but real issue (functional, not security per se).

---

## 2. Aspect 3 — plug-in & asset audit (full table)

Legend: **KEEP** = already fine / on target; **REPLACE** = swap for something modern; **DROP** = delete, not replacing; **EOL** = upstream end-of-life.

| # | Item | Version / ID | Load path | Status | Action | Replacement |
|---|---|---|---|---|---|---|
| 1 | `github-pages` gem | 193 (lockfile) | Ruby / build | EOL branch | REPLACE | N/A — move off Jekyll entirely (Astro). |
| 2 | `jekyll` | 3.7.4 (lockfile) | Ruby / build | 2 majors behind | REPLACE | Astro 4.x / 5.x (latest). |
| 3 | `jekyll-feed` | allowlist | Ruby / build | Fine | REPLACE | `@astrojs/rss`. |
| 4 | `jekyll-sitemap` | allowlist | Ruby / build | Fine | REPLACE | `@astrojs/sitemap`. |
| 5 | `bundler` | 1.16.4 | Ruby / build | EOL (1.x) | DROP | N/A (pnpm/npm). |
| 6 | Bootstrap CSS | 3.3.7 | `http://maxcdn.bootstrapcdn.com/...` | **Blocked by browsers (mixed content)** + EOL + sunset CDN | DROP | **Tailwind v4** via Astro integration, or hand-rolled modern CSS with container queries + fluid typography. |
| 7 | Bootstrap JS | 3.3.7 | `https://maxcdn...` | EOL + sunset CDN | DROP | No bootstrap needed — Astro islands for any interactivity. |
| 8 | jQuery | 3.3.1 | `googleapis` | CVE-2019-11358, CVE-2020-11022/11023 | DROP | No jQuery. |
| 9 | jQuery (second load) | 2.1.4 | `code.jquery.com` | Older, more CVEs; **double-loads and clobbers #8** | DROP | No jQuery. |
| 10 | Velocity.js | 1.2.3 | `cdn.jsdelivr.net` | Unmaintained | DROP | Native CSS transitions + `view-transitions-api` where needed. |
| 11 | Unslider | unknown | `/javascripts/unslider-min.js` | Unmaintained | DROP | Custom Astro `<Carousel>` using IntersectionObserver + CSS scroll-snap. Or just delete the carousel. |
| 12 | FontAwesome kit | `b2e828500b.js` | `use.fontawesome.com` (pre-FA5) | Deprecated kit CDN | REPLACE | **Lucide** icons (MIT, tree-shakable, ~1 KB per icon) or FA6 via Astro's `astro-icon`. |
| 13 | `scale.fix.js` | unknown | `https://ucdart.github.io/...` | Cross-site leftover | DROP | Delete. |
| 14 | `ucdart.ico` | n/a | `/ucdart.ico` | File missing / 404 + identity leftover | REPLACE | New MUSIC Lab favicon (SVG + fallback `.ico`). |
| 15 | MathJax | (unconfirmed, likely v2) | `_includes/mathjax_support` | Likely EOL branch | REPLACE | **KaTeX at build time** via `remark-math` + `rehype-katex`. No runtime JS. |
| 16 | Google Analytics (`ga.js`) | GA Classic | inline script | **Dead since 2016; UA dead since 2023** | DROP | **Nothing** — no replacement, no visit tracking at all (see §6 decision). |
| 17 | `_layouts/default.html` | hand-rolled | — | Not a dependency, but the source of 1–16 | REPLACE | New Astro `Base.astro` layout. |
| 18 | CodeQL workflow | — | `.github/workflows/codeql-analysis.yml` | Low value for Jekyll site | REVIEW | Keep post-migration (JS ecosystem is where it earns its keep), plus enable **Dependabot** for `npm`, `github-actions`, and the Deno Deploy broker source. |

Action items that don't need the full migration:

- **A1** (quick win, ~15 min): delete `scale.fix.js` and `ucdart.ico` references from the current `default.html` and drop the dead GA block. No replacement, just remove zombies. Can be done today as a PR against the current site without touching the migration.
- **A2** (quick win): flip the Bootstrap 3 CSS URL from `http://` to `https://` *if* you want the site to partially "work" during the migration window. Do not bother if the migration is imminent — it's a dead library either way.
- **A3**: enable Dependabot for `bundler` now, before the migration, to catch any critical issue in the Jekyll stack during the transition.

---

## 3. Aspect 1 — target architecture

### 3.1 Stack choice recap

| Layer | Choice | Why |
|---|---|---|
| Host | GitHub Pages | Keep the URL, keep "free forever", keep push-to-deploy mental model. |
| Build | GitHub Actions (`actions/deploy-pages`) | Escapes the default GH Pages Jekyll jail. Unlocks current Astro, any npm package. |
| Generator | **Astro** (4.x / 5.x) | Zod-validated content collections, first-class MDX, `astro:assets` for image optimization, island hydration only where needed. Compiles to static HTML that plays nicely with GH Pages. |
| Styling | **Tailwind v4** via `@astrojs/tailwind` | CSS-first config, responsive utilities baked in, ~10× faster builds than v3, dark mode free. Decided in §6. |
| Math | **KaTeX at build** (`remark-math` + `rehype-katex`) | No runtime JS, faster paint, no EOL risk. |
| Icons | `astro-icon` + **Lucide** | ~1 KB per icon, tree-shaken. |
| Search | Pagefind (`pagefind`) | Static-site full-text search, precomputed at build. |
| CMS | **Sveltia CMS** at `/admin/` | See §4. |
| OAuth broker | **Deno Deploy** | Free forever (1M req/day, no credit card), no sleep, global edge. Cloudflare Workers is an equivalent swap-in if preferences change. |

### 3.2 Astro project layout

```
music-sustech.github.io/
├── astro.config.mjs          # integrations: @astrojs/mdx, @astrojs/sitemap, @astrojs/rss,
│                             #   @astrojs/tailwind, astro-icon, pagefind, remark-math, rehype-katex
├── package.json              # pnpm preferred; Node 20 LTS
├── tsconfig.json
├── public/
│   ├── admin/                # Sveltia CMS SPA + config.yml (served statically)
│   ├── pdfs/                 # publication PDFs (batch-copied from old _publication/)
│   └── favicon.svg
├── src/
│   ├── content/
│   │   ├── config.ts         # Zod schemas — the source of truth for editorial validation
│   │   ├── publications/
│   │   │   └── 2025-xhwu-thz-pa.md
│   │   ├── people/
│   │   │   ├── current/
│   │   │   │   └── xinghua-wu.md
│   │   │   └── alumni/
│   │   │       └── ...
│   │   ├── news/
│   │   │   └── 2026-03-paper-accepted-imswym.md
│   │   └── research/
│   │       └── thz-imaging.md
│   ├── layouts/
│   │   ├── Base.astro
│   │   ├── Page.astro
│   │   └── Post.astro
│   ├── components/
│   │   ├── Nav.astro
│   │   ├── PublicationCard.astro
│   │   ├── PersonCard.astro
│   │   ├── NewsFeed.astro
│   │   ├── BibtexDialog.astro   # small island, only hydrates on click
│   │   └── SearchBox.astro      # Pagefind UI
│   ├── pages/
│   │   ├── index.astro
│   │   ├── people.astro
│   │   ├── people/alumni.astro
│   │   ├── publications.astro
│   │   ├── publications/[year].astro
│   │   ├── research/index.astro
│   │   ├── research/[slug].astro
│   │   ├── news/index.astro
│   │   ├── news/[...page].astro
│   │   ├── facilities.astro
│   │   ├── teaching.astro
│   │   ├── join.astro
│   │   └── rss.xml.ts
│   └── styles/
│       └── global.css
└── .github/workflows/
    ├── deploy.yml             # build + deploy-pages
    ├── pr-preview.yml         # optional: preview branch deploys
    └── link-check.yml         # lychee; nightly
```

### 3.3 Content collection schemas (sketch)

This is the single biggest editorial-hygiene improvement — the build fails loudly if a student commits a publication with a missing `year` or a person without a photo.

```ts
// src/content/config.ts
import { defineCollection, z } from 'astro:content';

const publications = defineCollection({
  type: 'content',
  schema: ({ image }) => z.object({
    title: z.string(),
    authors: z.array(z.string()).min(1),
    year: z.number().int().gte(2000).lte(2100),
    venue: z.string(),
    venueType: z.enum(['journal', 'conference', 'workshop', 'preprint', 'thesis']),
    doi: z.string().optional(),
    arxiv: z.string().optional(),
    pdf: z.string().optional(),         // path under /pdfs/
    bibtex: z.string().optional(),
    abstract: z.string().optional(),
    thumbnail: image().optional(),
    featured: z.boolean().default(false),
    tags: z.array(z.string()).default([]),
  }),
});

const people = defineCollection({
  type: 'content',
  schema: ({ image }) => z.object({
    name: z.string(),
    role: z.enum(['pi', 'postdoc', 'phd', 'masters', 'undergrad', 'visiting', 'staff']),
    status: z.enum(['current', 'alumni']),
    photo: image().optional(),
    email: z.string().email().optional(),
    scholar: z.string().url().optional(),
    github: z.string().optional(),
    linkedin: z.string().url().optional(),
    joined: z.string(),                  // 'YYYY-MM'
    left: z.string().optional(),
    currentPosition: z.string().optional(), // for alumni
    bio: z.string().optional(),
  }),
});

const news = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    date: z.date(),
    tags: z.array(z.string()).default([]),
    pinned: z.boolean().default(false),
  }),
});

const research = defineCollection({
  type: 'content',
  schema: ({ image }) => z.object({
    title: z.string(),
    order: z.number().int().default(100),
    hero: image().optional(),
    shortDescription: z.string(),
  }),
});

export const collections = { publications, people, news, research };
```

Notes:

- The `image()` helper (Astro) means `photo:` and `thumbnail:` are *type-checked paths to real files in the repo*, not free-form URLs. This alone would have caught `ucdart.ico`.
- `role: z.enum([...])` enforces consistent labels so the People page can group by role without string-matching accidents.
- `status: current|alumni` replaces a giant monolithic people/index.md — you split files, and current-vs-alumni is a one-line filter.

### 3.4 Math, images, fonts

- **Math**: `astro.config.mjs` chains `remark-math` + `rehype-katex`. KaTeX CSS is self-hosted from `node_modules/katex/dist/katex.min.css`. No runtime JS, no CDN.
- **Images**: use `<Image>` from `astro:assets`. Any image referenced from a content collection frontmatter via `image()` is auto-optimized into WebP/AVIF with responsive `srcset`. The gallery carousel on the landing page becomes a plain CSS scroll-snap strip, no JS.
- **Fonts**: self-host via **Fontsource** (e.g., `@fontsource-variable/inter` + `@fontsource/lora`) to avoid Google Fonts privacy/latency and to not depend on any CDN.
- **Visit analytics**: none, by decision (see §6). No tracker script, no pixel, no banner. The existing GA fossil is deleted outright in §2/A1 rather than replaced.

### 3.5 Build & deploy workflow

Outline of `.github/workflows/deploy.yml`:

```yaml
name: Deploy site
on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm run build             # astro build
      - run: pnpm dlx pagefind --site dist   # build the search index
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

This is the entire deploy story. Hosting, URL, TLS, all still GitHub. Difference: Jekyll is gone.

### 3.6 Non-functional targets

| Metric | Today (observed/estimated) | Target |
|---|---|---|
| Lighthouse Performance (mobile) | ~50–70 (mixed content, 3×jQuery, carousel JS) | ≥ 95 |
| Lighthouse Accessibility | ~60–75 (no `<nav>`, no ARIA, low contrast) | ≥ 95 |
| Lighthouse Best Practices | degraded by mixed content | 100 |
| Lighthouse SEO | ~90 | 100 |
| First Contentful Paint (fast 3G) | not measured, likely >3 s | < 1.5 s |
| Total JS shipped, home page | ~150+ KB (jQuery×2, Bootstrap, Velocity, Unslider, GA fossil) | ~0 KB on static pages; small islands only where interactivity exists |

---

## 4. Aspect 2 — Sveltia CMS for students

### 4.1 Why Sveltia over Decap

- **Maintenance.** Decap (née Netlify CMS) has been in effective maintenance-mode drift since Netlify stopped funding it; the issue backlog on GitHub is multi-year and feature releases are sparse. Sveltia is actively developed with a clear roadmap.
- **UX.** Sveltia's editor is a full Svelte rewrite: fast load, clean layout, better forms, asset picker, i18n out of the box. Decap's React editor shows its age.
- **Config compatibility.** Sveltia uses the **same `config.yml` format as Decap**, so if it ever went sideways you could literally swap the one JS file and keep your config. Zero lock-in.
- **GitHub backend** is supported natively. Same OAuth flow as Decap → same broker works → we won't have wasted work if we reconsider.

### 4.2 Component architecture

```
[ student browser ]
      |
      | visits /admin/
      v
[ Sveltia SPA hosted from the same GH Pages site ]
      |
      | "Login with GitHub"
      v
[ Deno Deploy OAuth broker ]
      |
      | OAuth dance with GitHub, returns access token
      v
[ Sveltia uses the token to call GitHub REST API directly ]
      |
      | commits *.md + images to the repo (branch: main or cms/<username>)
      v
[ GH Actions deploy.yml fires, rebuilds site ]
```

Key properties:

- **No separate CMS backend server.** Sveltia is a static SPA; the only always-on piece is the tiny Deno Deploy service that exchanges OAuth codes for tokens.
- **Students use their own GitHub accounts.** Commits are attributed. Full audit trail. You can still use branch protection / PR review on `main`.
- **Images** are uploaded directly to the repo by Sveltia through the GitHub API. The `astro:assets` pipeline processes them on the next build.

### 4.3 Student editorial flow — "add a publication"

1. Student visits `https://music-sustech.github.io/admin/` on their laptop (or phone — Sveltia is responsive).
2. Click "Log in with GitHub", authorize the OAuth app. First time only.
3. Pick **Publications** collection → **New publication**.
4. Fill in form fields. The form is generated from `config.yml`, which mirrors our Zod schema: title, authors (chip input, comma-separated), year (number), venue, venue type (dropdown), DOI, arXiv, PDF upload, abstract (rich text), thumbnail upload, featured (checkbox), tags.
5. Click **Save**. Sveltia commits a new `src/content/publications/2026-xhwu-new-paper.md` with the PDF in `public/pdfs/`. Either directly to `main`, or — better — onto a branch named `cms/xhwu/2026-xhwu-new-paper` and opens a PR automatically.
6. GH Actions builds a preview deployment (Phase 2 adds a `pr-preview.yml` workflow for this). Student previews, merges the PR.
7. Deploy workflow fires, site updates within ~1–2 minutes.

The equivalent flow for "update a person" or "post news" is identical — only the form fields differ.

### 4.4 OAuth broker on Deno Deploy

- Create a **GitHub OAuth App** (not a GitHub App — OAuth App is the one that supports the web flow Sveltia/Decap expect).
  - Client ID, client secret: store as Deno Deploy environment variables (encrypted at rest).
  - Authorization callback URL: `https://<your-project>.deno.dev/callback`.
- The broker is a single TypeScript file (~40 lines) with two routes:
  - `GET /auth` → redirects to GitHub's authorize URL with scope `repo`.
  - `GET /callback?code=...` → exchanges code for token, returns a tiny HTML page that `postMessage`s the token back to the Sveltia tab.
- Set Sveltia's `config.yml` `backend:`
  ```yaml
  backend:
    name: github
    repo: music-sustech/music-sustech.github.io
    branch: main
    base_url: https://<your-project>.deno.dev
    auth_endpoint: auth
  ```
- Cost: **zero**. Deno Deploy's free tier is 1M requests/day, forever, no credit card — orders of magnitude more than a 15-person lab will ever use, and no cold-start / sleep penalty.
- Deployment: link the broker folder to Deno Deploy via its GitHub integration; every push redeploys automatically. No CLI, no wrangler, no local tooling.
- Reference implementations exist as community templates for both Deno runtimes and Cloudflare Workers — we'll adapt one in Phase 4 rather than writing from scratch.
- **Swap-in alternate**: **Cloudflare Workers** is an equivalent free option (100k req/day, no credit card) if Deno Deploy ever becomes inconvenient. The broker is plain `fetch()` handlers and ports in ~15 minutes. We document the alternate so there's no vendor lock-in.

### 4.5 Failure modes & mitigations

| Failure mode | Consequence | Mitigation |
|---|---|---|
| OAuth client secret leaks from broker | Attacker can impersonate the app; on approval, mint tokens with `repo` scope | Store as a Deno Deploy environment variable (encrypted at rest); rotate quarterly; enable GitHub OAuth App "require approval" for new users. |
| Student's token is intercepted on the wire | Direct commit access to the repo | HTTPS enforced throughout; token is passed via `postMessage`, never in a URL. Tokens are session-scoped. |
| Schema drift (student edits markdown directly, skips the CMS) | Frontmatter falls out of schema, build breaks | Zod schema in `src/content/config.ts` fails the Actions build loudly. Better than silent corruption. |
| Student accidentally commits to `main` unreviewed | Bad content goes live | Enable branch protection on `main`; require PR + 1 review. Sveltia supports `editorial_workflow`: open as draft PR, require merge. |
| Sveltia project becomes unmaintained | CMS stops working | `config.yml` is Decap-compatible → swap the one JS file back to Decap in ~10 min. Or move to TinaCMS. Content files are plain markdown, no lock-in. |
| Deno Deploy outage | Students can't log in for a few hours | Low-severity; students can still edit markdown files directly via `github.com` web UI during an outage. Broker code ports to Cloudflare Workers in ~15 min if Deno Deploy becomes unreliable. |
| `UA-58268327-1` kept as a fossil | — | Already dead, delete in Phase 2. |

---

## 5. Migration plan — four phases

### Phase 1 — inventory, audit close-out, quick wins

**Goal: zero new architecture, just know what we're porting and remove dead code on the existing site.**

Deliverables:
1. Full content inventory CSV: every URL on the current live site, every markdown file, every image, every PDF, every external link. (Generated by a small crawl script.)
2. Front-matter histogram of `_publication/*.md`: what keys actually appear, what's sometimes missing. This informs the Zod schema final shape.
3. Research-directory per-file inventory (`research/`, `facilities/`, `resources/`, etc.) — contents I haven't inspected yet.
4. Confirm MathJax version by reading whatever file the Liquid `{% include mathjax_support %}` resolves to.
5. **Action items A1–A3** landed as PRs against the current site:
   - Delete `scale.fix.js` reference and `ucdart.ico` reference.
   - Delete the dead GA block entirely.
   - (Optional) fix the mixed-content Bootstrap `http://` → `https://` if we want the old site to look less broken during the migration window.
   - Enable Dependabot for Bundler.
6. Create a **new GitHub Project** (or just a markdown tracker in this folder) enumerating every page of the current site and whether it must preserve its URL, be redirected, or be deleted.

Exit criteria: we know exactly what has to exist after the cutover, and the current site is slightly less embarrassing in the meantime.

### Phase 2 — Astro scaffold + deploy plumbing

**Goal: a live preview site of the new stack with exactly one publication, one person, one news post — end-to-end.**

Deliverables:
1. New branch `astro-rebuild` on the existing repo, not a separate repo — the `main` branch keeps serving the old Jekyll site via the default GH Pages build until Phase 4.
2. `astro.config.mjs` wired up with all integrations listed in §3.
3. `src/content/config.ts` with the four Zod schemas from §3.3, tuned against the Phase 1 histogram.
4. **Branding proposal** (precedes widescale styling work): written and committed at `group-site-2026/branding-proposal.md` (2026-04-11). Presents two palette directions ("Ink on paper" vs. "Technical report"), two typography pairings (Source Serif 4 + Inter vs. IBM Plex family), and a real Tailwind v4 `@theme` stub. **Five open questions pending PI sign-off** (direction A/B, pairing A/B, SUSTech-tinted accent hex, dark-mode toggle, wordmark short/full) — Phase 2 layout work is blocked on those answers by design.
5. `src/layouts/Base.astro` + `Nav.astro` + `Footer.astro` with the new responsive structure in Tailwind v4, using the approved theme tokens. **Wordmark-only header** — a typographic treatment of "MUSIC Lab" (or the full expanded name), no logo symbol. Nav uses semantic `<nav>` with proper ARIA.
6. One publication, one person, one news post hand-authored in the new schema as a smoke test.
7. `.github/workflows/deploy-astro-preview.yml` — builds the `astro-rebuild` branch (and later, any open PR branch) and pushes the built `dist/` into the sibling preview repo **`music-sustech/music-sustech-preview.github.io`**, whose GH Pages *is* the preview URL. Last-push-wins on concurrent PRs (acceptable for a 15-person lab under editorial_workflow). Documented upgrade path if that becomes painful: push each PR's build into a `/pr/<number>/` subdirectory of the preview repo instead of overwriting root.
8. Lighthouse run against the preview site as a sanity check — we should already be at ≥95 Performance for a 3-item site.

Exit criteria: preview deployment exists, one of each content type renders correctly, math renders via KaTeX, images optimize via `astro:assets`, build time < 1 min.

### Phase 3 — content port

**Goal: migrate everything. No CMS yet.**

Deliverables:
1. `scripts/migrate-publications.mjs` — reads every `_publication/*.md`, parses the legacy front matter, outputs a new `src/content/publications/*.md` file conforming to the Zod schema. **Migrates all files, including DART-era papers, per Option A (§6).** Runs as pure Node, idempotent, spot-check friendly. Batch copies PDFs to `public/pdfs/`. Logs anything it can't map for manual review.
2. `scripts/migrate-news.mjs` — port the 15 `_posts/*.md` files, fix dates, prune the `- Copy.md` duplicate. DART-era news posts are kept in the main feed (consistent with Option A for publications) and tagged `dart-era` so they can be filtered later if ever wanted.
3. `scripts/migrate-people.mjs` — this one is more interactive: parse `people/index.md`, extract each person's block into its own file, fetch photos from `people/images/`, guess role/status, write one file per person. Manual review of each output expected.
4. Port `research/`, `facilities/`, `education/`, `resources/` into Astro pages. Drop `uav/` and `utilities/` per §6, but copy `uav/uav.png` into `public/images/` first so the asset survives.
5. Redirect table: for every old URL whose slug/structure changes, add an entry. Jekyll permalink `/blog/:year/:month/:day/:title` → Astro `/news/:year/:month/:title` etc. GitHub Pages doesn't support server-side redirects, so we use static HTML files with `<meta http-equiv="refresh">` + canonical link, generated as part of the build.
6. Run Pagefind, verify full-text search works.
7. Run a link checker (`lychee`) against the built site, fix any broken internal links from the port.

Exit criteria: preview site has full parity (content and URLs) with the live site. PI review before proceeding.

### Phase 4 — CMS wiring & cutover

**Goal: Sveltia live, students trained, main branch flipped.**

Deliverables:
1. GitHub OAuth App created in the `music-sustech` org.
2. Deno Deploy OAuth broker deployed. Source in `ops/cms-oauth-broker/` (kept separate from the site repo or as a `/tools/` subfolder — decide at kickoff). Deno Deploy's GitHub integration handles continuous deploy; no wrangler, no local CLI.
3. `public/admin/index.html` + `public/admin/config.yml` wired up with Sveltia CMS CDN reference + `backend: github` configured to use the Worker.
4. Editorial workflow enabled in `config.yml` so students open PRs instead of direct-committing.
5. Branch protection rule on `main` requiring PR + 1 review.
6. Dependabot enabled for `npm` + `github-actions`.
7. CodeQL workflow retained (now actually scans the JS of interest).
8. Training: 30-minute session with one senior student, write up a 1-page cheat sheet in `group-site-2026/cms-quickstart.md` (mirrors the precedent set by `overleaf-git-workflow/`).
9. **Cutover**: merge `astro-rebuild` → `main`, delete the old Jekyll files, delete the default GH Pages build setting, enable the new GH Actions deploy. Monitor for one week.
10. Post-cutover: kill the dead GA tracker, kill `ucdart.*` leftovers once and for all, update `README.md`.

Exit criteria: one student has successfully added one new publication via Sveltia without PI intervention. Live site serves from Actions, not the default GH Pages Jekyll build.

---

## 6. Decisions & open questions

**Resolved in this brainstorm (2026-04-11):**

- **Analytics**: **none**. No visit analytics, no tracker, no pixel, no replacement for the dead GA block. Durable preference across all MUSIC Lab web artifacts, not just this site.
- **OAuth broker host**: **Deno Deploy** (1M req/day, free forever, no credit card, no sleep, no CLI). **Cloudflare Workers** documented as an equivalent free swap-in — broker code ports in ~15 min, no vendor lock-in.
- **DART-era publications**: **Option A — full PI publication record.** All ~100 publication markdowns migrate into the main publication list alongside SUSTech-era papers. No "Legacy (UC Davis)" section, no culling. Site represents Prof. Liu's full career bibliography. DART-era news posts tagged `dart-era` for optional filtering.
- **Preview deployment**: **sibling preview repo** `music-sustech/music-sustech-preview.github.io`. Main repo's PR workflow builds and pushes `dist/` there; that repo's GH Pages auto-deploys. Single fixed preview URL; last-push-wins on concurrent PRs (fine for a 15-person lab). Per-PR subdirectory upgrade path documented in Phase 2.
- **Styling**: **Tailwind v4** via `@astrojs/tailwind`. CSS-first config, responsive utilities baked in, ~10× faster builds than v3, dark mode free.
- **Alumni pages**: **per-person files, two grouped views.** `/people` groups current members by role with full bio cards; `/people/alumni` is a compact `year | name | degree | now at X` list grouped by year-departed. No full bio pages for alumni. Schema (`status: current | alumni`) already supports it.
- **Bilingual**: **EN-only everywhere.** No ZH version, no ZH recruiting subpage. All content authored in English. Prioritizes maintenance simplicity over domestic recruiting reach.
- **Branding**: **wordmark only** (no lab logo symbol). Site's visual anchor is a typographic treatment of "MUSIC Lab" (or the full expanded name). SUSTech brand guidelines: **encouraged, not enforced** — cues taken where easy, no strict conformance. Phase 2 produces a **proposed academic-minimal direction** (1–2 palette + type pairings + a Tailwind v4 theme stub) for PI approval before widescale styling work.
- **Domain**: **stay on `music-sustech.github.io`.** Zero SUSTech DNS paperwork. Downside (long URL, identity tied to GitHub long-term) accepted in exchange for migration velocity. Can revisit after cutover if SUSTech IT ever simplifies the subdomain process.
- **`uav/` and `utilities/` directories**: **delete both, with one exception — preserve `uav/uav.png`** as a reusable image asset (migrate into `public/images/` in the new site). Everything else is dropped: the two 2015 DART-era senior design PDFs, the obsolete Jekyll build scripts (`collection_builder.py`, `update_publication.py`), and the accidentally-committed `.pyc` / `.bak` cruft. `uav/` nav link was already commented out on the live site, so nothing user-visible is lost.

**Still open:** *(none — all questions resolved 2026-04-11)*

---

## Appendix A — raw evidence from current `_layouts/default.html`

(For reproducibility of the audit claims in §1.3 / §2. This block is not commentary; it's the ground truth.)

```html
<link rel="shortcut icon" type="image/x-icon" href="/ucdart.ico">
<link rel="stylesheet" href="http://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/css/bootstrap.min.css">
<link rel="stylesheet" type="text/css" href="/stylesheets/styles.css">
<link rel="stylesheet" type="text/css" href="/stylesheets/pygment_trac.css">
<script src="https://ajax.googleapis.com/ajax/libs/jquery/3.3.1/jquery.min.js"></script>
<script src="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/js/bootstrap.min.js"></script>
<script src="https://use.fontawesome.com/b2e828500b.js"></script>
<script src="//code.jquery.com/jquery-2.1.4.min.js"></script>
<script src="//cdn.jsdelivr.net/velocity/1.2.3/velocity.min.js"></script>
<script src="/javascripts/unslider-min.js"></script>
<link rel="stylesheet" href="/stylesheets/unslider.css">
<link rel="stylesheet" href="/stylesheets/unslider-dots.css">
{% include mathjax_support %}
...
<script src="https://ucdart.github.io/javascripts/scale.fix.js"></script>
<script type="text/javascript">
  var gaJsHost = (("https:" == document.location.protocol) ? "https://ssl." : "http://www.");
  document.write(unescape("%3Cscript src='" + gaJsHost + "google-analytics.com/ga.js' type='text/javascript'%3E%3C/script%3E"));
</script>
<script type="text/javascript">
  try {
    var pageTracker = _gat._getTracker("UA-58268327-1");
    pageTracker._trackPageview();
  } catch(err) {}
</script>
```

## Appendix B — raw `_config.yml`

```yaml
name: Microsystems for Ubiquitous Sensing, Intelligence, and communication (MUSIC) Lab at the Southern University of Science and Technology (SUSTech)
permalink: /blog/:year/:month/:day/:title
collections:
  publication:
    output: true
  blog:
    output: true
excerpt_separator: <!--more-->
plugins:
  - jekyll-feed
  - jekyll-sitemap
```

## Appendix C — content inventory counts (current repo)

| Directory | Count | Notes |
|---|---|---|
| `_publication/` | ~200 files (≈100 md + ≈100 pdf) | Legacy UC Davis + SUSTech. All migrated per Option A (§6) — full PI record, no culling. |
| `_posts/` | 15 files | Last: 2019-04-10. Includes one `- Copy.md` artifact. |
| `people/` | 1 `index.md` + `openings.md` + 2 postdoc pages + `files/` + `images/` | Monolithic. Biggest editorial pain. |
| `.github/workflows/` | 1 file | `codeql-analysis.yml` only. |
| `_config.yml` plugins | 2 | `jekyll-feed`, `jekyll-sitemap`. |
