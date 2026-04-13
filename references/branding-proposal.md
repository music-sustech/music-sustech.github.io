# MUSIC Lab website — branding proposal

**Phase 2 deliverable for `group-site-2026/` (per §6 of `brainstorm.md`). Date: 2026-04-11.**

Purpose: establish the visual direction for the new Astro-based site **before** component work begins. The brainstorm resolved to ship a **wordmark-only, academic-minimal** site with SUSTech brand cues **encouraged but not enforced**. Phase 2 can't start styling work until palette, typography, and a concrete Tailwind v4 theme stub are signed off.

One-pager structure, deliberately opinionated. PI picks one direction + one type pairing; everything downstream follows.

---

## 1. Design tenets

Five principles. If a later proposal violates one, reject it — don't renegotiate the tenet.

1. **Research is the content.** The home page's job is to get a reader from landing → "which paper am I here for" in under two clicks. Chrome (nav, footer, sidebars) is subordinate to bibliographic density.
2. **Typography first, color second, imagery never.** No hero photos, no stock imagery, no decorative gradients. Figures from papers are welcome; mood-board photos are not.
3. **Resilient to 15 contributors.** No brittle components that break when a student adds a publication with a 140-character title or an all-caps venue acronym. Every layout must survive the longest real record in the corpus.
4. **Respects SUSTech identity without being a reskin.** University brand cues taken where free (accent color, wordmark posture) but never forced to the point of looking like a department landing page embedded in the SUSTech CMS.
5. **Mobile-first, dense on desktop.** Phone layouts collapse cleanly; desktop layouts use the extra space to show more publications per screen, not to center a narrower column of whitespace.

---

## 2. Palette directions

Two genuinely distinct directions. Not color variants of the same idea.

### Direction A — "Ink on paper"

Warm off-white background, near-black text, a single restrained accent. Reads as academic the moment you land. Evokes arXiv mixed with older Princeton / MIT faculty pages. Timeless.

| Token | Hex | Role |
|---|---|---|
| `--color-ink` | `#111111` | Primary text. Not pure black — too harsh against off-white. |
| `--color-paper` | `#FAF8F3` | Page background. Warm off-white, avoids pure-white glare. |
| `--color-muted` | `#6B6760` | Secondary text (dates, affiliations, metadata). |
| `--color-line` | `#E4DFD4` | Hairlines, table borders, card separators. |
| `--color-accent` | `#7C2D12` | Links, active nav, year badges. Burnt amber — warm, distinctive, prints well. |
| `--color-accent-soft` | `#FED7AA` | Accent highlights / callout backgrounds. |

Kindred spirits (reference points only, not claims of partnership): arxiv.org, distill.pub, older TUG/LaTeX community pages, the default Tufte-CSS look.

### Direction B — "Technical report"

True white background, sans + mono pairing, accent used only for links and tags. Feels like a cross between OpenReview and the GitHub Docs site. More contemporary, reads as "engineering department" rather than "humanities department."

| Token | Hex | Role |
|---|---|---|
| `--color-ink` | `#0B0F14` | Primary text. Cool near-black. |
| `--color-paper` | `#FFFFFF` | Page background. True white. |
| `--color-muted` | `#4B5563` | Secondary text. |
| `--color-line` | `#E5E7EB` | Hairlines / borders. |
| `--color-accent` | `#1D4ED8` | Links, active nav. Restrained blue — reads as technical, not startup-y. |
| `--color-accent-soft` | `#DBEAFE` | Accent highlights. |

Kindred spirits: openreview.net, docs.github.com, the IEEE Xplore article view minus IEEE's chrome.

### SUSTech-tinted variant (optional overlay)

Either direction can swap `--color-accent` for a SUSTech-derived hue. **Action item for PI:** please share the canonical accent hex from the official SUSTech brand guideline PDF — I won't fabricate a value. Once confirmed, the swap is a one-line change in the theme stub (§4).

---

## 3. Typography pairings

Two pairings. Both self-hostable via Fontsource — no Google Fonts CDN call, consistent with the no-tracker posture from `brainstorm.md` §6.

### Pairing A — Source Serif 4 + Inter + JetBrains Mono

- **Display / headings**: Source Serif 4 (SIL OFL, Adobe-commissioned). Contemporary serif designed for screen reading.
- **Body**: Inter (SIL OFL). De-facto neutral UI sans, x-height tuned for 16–18px body text.
- **Mono**: JetBrains Mono (SIL OFL). For inline identifiers, equations, code, BibTeX blocks.
- **Payload**: three families subset to Latin only. Rough budget ~120 KB total across used weights (display 600, body 400/600, mono 400), self-hosted with `font-display: swap`.
- **Fits**: Direction A most naturally. Can also work with B if the serif is limited to page titles.

### Pairing B — IBM Plex family (Sans + Serif + Mono)

- **Display / body / mono**: all from IBM Plex (SIL OFL, IBM-commissioned, open source). Single family = fewer font files, visually consistent, distinctive without being flashy.
- **Payload**: ~90 KB total — one family's worth of files regardless of how many sub-styles you pull in.
- **Fits**: Direction B most naturally. Plex Sans has a slightly engineered feel that matches a cool-white + blue-accent direction.

**Default recommendation**: **Pairing A + Direction A** for the strongest "academic at first glance" read. **Pairing B + Direction B** is the runner-up if you prefer a more contemporary, less "humanities journal" vibe.

---

## 4. Tailwind v4 theme stub

Real, copy-pasteable. Goes at the top of `src/styles/global.css` in the new Astro project. Uses Tailwind v4's CSS-first `@theme` directive — no `tailwind.config.js` file needed.

```css
@import "tailwindcss";

@theme {
  /* ---- Color (Direction A — swap for B by replacing these six) ---- */
  --color-ink:          #111111;
  --color-paper:        #faf8f3;
  --color-muted:        #6b6760;
  --color-line:         #e4dfd4;
  --color-accent:       #7c2d12;
  --color-accent-soft:  #fed7aa;

  /* ---- Type (Pairing A) ---- */
  --font-display: "Source Serif 4", ui-serif, Georgia, "Times New Roman", serif;
  --font-body:    "Inter", ui-sans-serif, system-ui, -apple-system, sans-serif;
  --font-mono:    "JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace;

  /* ---- Rhythm ---- */
  --text-prose-max:  68ch;   /* paragraph measure */
  --text-wide-max:   88ch;   /* tables, pub lists  */
  --leading-tight:   1.15;   /* headings */
  --leading-base:    1.65;   /* body     */

  /* ---- Spacing additions (everything else is default Tailwind) ---- */
  --spacing-section: 4.5rem; /* between major page sections */
  --spacing-gutter:  1.5rem; /* card interior padding       */
}

@layer base {
  html {
    font-family: var(--font-body);
    color: var(--color-ink);
    background: var(--color-paper);
    line-height: var(--leading-base);
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
  }
  h1, h2, h3, h4 {
    font-family: var(--font-display);
    line-height: var(--leading-tight);
    letter-spacing: -0.01em;
  }
  a {
    color: var(--color-accent);
    text-underline-offset: 0.2em;
    text-decoration-thickness: 0.06em;
  }
  hr {
    border: 0;
    border-top: 1px solid var(--color-line);
  }
}
```

What this gives you out of the box:

- `text-ink`, `bg-paper`, `border-line`, `text-accent`, `font-display`, `font-body` are automatically available as Tailwind utility classes via v4's token-to-utility mapping.
- **Swap Direction A → B** by replacing the six color variables. Nothing else changes.
- **Swap Pairing A → B** by replacing the three font variables + updating the `@font-face` imports at the top of the file. Nothing else changes.

---

## 5. Component sketches (prose, not pixels)

Enough detail to picture the site and push back on specifics. Actual Astro components come in Phase 2.

**Wordmark.** Plain text, not an image. `MUSIC Lab` in the display face at weight 600, followed on a second line by the expanded name (`Microsystems for Ubiquitous Sensing, Intelligence, and communication`) in the body face, muted color, one size smaller. Clickable, goes home. No symbol, no decorative bracket.

**Top nav.** Single row on desktop, hamburger on mobile. Five links max: `Research · Publications · People · News · Join Us`. Active page shown with an accent-colored underline, not a filled pill. Sticky on scroll.

**Homepage hero.** No carousel, no animation. One short paragraph of lab-overview prose (3–4 sentences), then a two-column split: recent publications (left, 5 items) and recent news (right, 3 items). Whole thing fits above the fold on a 1366×768 laptop.

**Publication card.** Single line on desktop, wraps on mobile. Shape: `[year]  Title.  Authors.  *Venue*, year.  [PDF] [DOI] [BibTeX]`. No thumbnail by default — thumbnails live on the publication's detail page. Featured publications get a hairline border-left in accent color.

**People card (current members).** Headshot (square, 160px max), name in display face, role + year (`PhD student · Year 3`) in muted body. Three-line bio. Research interests rendered as hairline-bordered tags. Email icon only if the person opted in (schema has a `showEmail` boolean).

**People table (alumni).** Not cards. Dense table: `Year departed | Name | Degree | Now at`. Grouped by year descending. This is a list, not a gallery — resist the urge to gallery-ify it.

**News item.** Date (muted), title (display face, link), one-paragraph excerpt, read-more link. No thumbnail, no author photo. Visually sits between a blog post and a changelog entry.

**Publication detail page.** Full citation at the top, then abstract, then BibTeX in a `<pre>` block under `font-mono`, then links (PDF, DOI, arXiv, venue). Optional figure strip at the bottom if the paper has teaser images in the content collection.

---

## 6. Rejected directions (don't relitigate)

- **Dark mode as default.** Academic content with equations and figures reads worse when inverted; 90%+ of time-on-site will be reading. (Dark-mode *toggle* is still on the table — see §7.)
- **Hero photography / stock imagery.** Violates tenet #2. If the homepage needs visual interest, it comes from a real figure from a real paper.
- **Glassmorphism / gradient accents / animated backgrounds.** Dates the site in 18 months; conflicts with "timeless academic." Hard no.
- **Logo symbol / monogram.** Already resolved in `brainstorm.md` §6 — wordmark only.
- **Carousel on the homepage.** Nobody clicks past slide one. A publication list and a news list serve the same purpose with higher information density.
- **Heavy iconography (full Material or Font Awesome sprite).** `lucide` via `astro-icon` with a small hand-picked set only — roughly: `external-link`, `file-text`, `search`, `menu`, `x`, `chevron-right`, `mail`. No more than ~10 icons total in the shipped bundle.

---

## 7. Open questions for PI

Pick one answer per question; that's enough to unblock Phase 2 styling.

1. **Direction A or B?** "Ink on paper" (warm, serif-led, arXiv-ish) vs. "Technical report" (cool white, sans-led, OpenReview-ish).
2. **Pairing A or B?** Source Serif 4 + Inter vs. IBM Plex family. Default recommendation pairs A+A or B+B, but they can be crossed.
3. **SUSTech-tinted accent?** If yes, please share the canonical accent hex from the SUSTech brand guideline PDF — I won't fabricate one.
4. **Dark-mode toggle?** Opt-in toggle in the footer (respects `prefers-color-scheme`, defaults to light) — yes or no? Adds roughly one evening of work in Phase 2. Default-light regardless of answer.
5. **Wordmark — short or full?** Two-line wordmark with expanded name (as described in §5), or single-line `MUSIC Lab` only?

Once these are answered, Phase 2 styling can start against the stub in §4.

---

*End of proposal. This file is intentionally short. If it grows past ~400 lines, something has gone wrong.*
