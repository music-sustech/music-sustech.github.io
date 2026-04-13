# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this directory is

This is the **coding workspace** for the MUSIC Lab website rebuild. The two files in `references/` were produced in a separate planning-only workspace and copied in here as reference inputs that guide the implementation work that happens in this directory.

- **Live site:** `https://music-sustech.github.io`
- **Source repo (Jekyll, legacy):** `github.com/music-sustech/music-sustech.github.io`
- **This workspace:** where the new Astro site is built. The legacy Jekyll repo may be cloned in as a sub-directory (e.g. `legacy/`) so migration scripts can read it directly.

As of the latest read, no Astro scaffold or `package.json` exists here yet — only `references/` and this file. Expect that to change as work progresses.

## Canonical sources of truth — read before doing anything

Both files are the result of an extensive brainstorm and should be treated as authoritative. Do not relitigate decisions recorded there without an explicit reason from the user.

- `references/brainstorm.md` — the full migration plan. Audit of the current site, target architecture, four-phase migration plan, and §6 "Decisions & open questions" which records every locked decision with its rationale.
- `references/branding-proposal.md` — Phase 2 visual-direction proposal. Two palette directions, two type pairings, a real Tailwind v4 `@theme` stub, and the five PI sign-off questions that currently block Phase 2 styling work.

When the user references "the brainstorm" or "the proposal," these are the files they mean. When in doubt about a design or scope question, check `brainstorm.md` §6 first — it's the decision log.

## Locked decisions (do not relitigate)

These were resolved on 2026-04-11 in `brainstorm.md` §6. Treat them as constraints, not options:

- **Stack:** Astro (4.x/5.x) + Tailwind v4 + content collections with Zod schemas. Hosted on GitHub Pages, built via GitHub Actions (`actions/deploy-pages`), not the default GH Pages Jekyll build. Same `music-sustech.github.io` URL.
- **CMS:** Sveltia CMS at `/admin/`, GitHub backend, with a **Deno Deploy** OAuth broker (Cloudflare Workers documented as a swap-in alternate, no lock-in). Editorial workflow on, branch protection on `main`.
- **Math:** KaTeX at build time (`remark-math` + `rehype-katex`). No runtime MathJax.
- **Search:** Pagefind, built into the deploy workflow.
- **Icons:** Lucide via `astro-icon`, hand-picked set (~10 icons), no full FontAwesome sprite.
- **Fonts:** Self-hosted via Fontsource. No Google Fonts CDN.
- **Analytics: none.** No tracker, no pixel, no replacement for the dead GA block. This is a **durable preference across all MUSIC Lab web artifacts**, not just this site.
- **Bilingual: EN-only.** No ZH version.
- **Branding:** wordmark-only, no logo symbol. SUSTech brand cues encouraged, not enforced.
- **Domain:** stay on `music-sustech.github.io`. No SUSTech subdomain.
- **DART-era publications:** Option A — full PI publication record, all ~100 legacy markdowns migrate alongside SUSTech-era papers. No "Legacy" section.
- **Alumni:** per-person files, two grouped views (`/people` cards for current, `/people/alumni` dense table grouped by year-departed).
- **Preview deploys:** sibling preview repo `music-sustech/music-sustech-preview.github.io`, last-push-wins.
- **`uav/` and `utilities/`:** delete on migration, except preserve `uav/uav.png` as an asset.

## Open questions blocking Phase 2

`branding-proposal.md` §7 lists five questions awaiting PI sign-off. Until they are answered, layout/styling work is blocked **by design** (don't try to start Phase 2 components without them):

1. Palette direction A ("Ink on paper") or B ("Technical report")?
2. Type pairing A (Source Serif 4 + Inter) or B (IBM Plex)?
3. SUSTech-tinted accent hex (if yes, the PI must supply it from the official brand guideline PDF — do not fabricate one)?
4. Dark-mode toggle yes/no?
5. Wordmark short (`MUSIC Lab`) or full (two-line with expanded name)?

The user is the PI and is the decision-maker for all five — ask them directly when the answers are needed, don't make any of the calls unilaterally.

## Migration phases (high level)

Defined in `brainstorm.md` §5. Use these as the mental model for where any given task fits:

1. **Phase 1** — inventory + audit close-out + quick wins on the existing site (delete `ucdart.*` leftovers, dead GA block, enable Dependabot for Bundler).
2. **Phase 2** — Astro scaffold + deploy plumbing + branding sign-off + one of each content type rendering end-to-end on a preview URL. **Currently blocked on the five branding questions above.**
3. **Phase 3** — content port. The bulk of this is `scripts/migrate-publications.mjs`, `scripts/migrate-news.mjs`, and `scripts/migrate-people.mjs` — Node scripts that rewrite legacy Jekyll markdown into the new Zod-validated content collections. Spot-check friendly, idempotent.
4. **Phase 4** — Sveltia + OAuth broker + cutover. Merge `astro-rebuild` → `main`, flip GH Pages off, GH Actions deploy on.

## Working notes

- **No commands to document yet.** There is no `package.json`, no build, no test runner in this directory. When the Astro scaffold lands (Phase 2), this section should be updated with the real `pnpm` commands (`pnpm dev`, `pnpm build`, `pnpm dlx pagefind --site dist`, etc.).
- **Do not create files speculatively.** New files should correspond to a specific deliverable from a phase in `brainstorm.md` §5, or to something the user has explicitly asked for.
- **Migration scripts, when written, are pure Node, idempotent, and log unmappable records rather than failing.** This is stated in Phase 3 deliverables.
- **The current live site is broken in non-obvious ways** (Bootstrap 3 CSS loaded over `http://` and blocked by browsers, jQuery double-loaded, GA fossil from 2016, references to the previous lab's `ucdart.github.io`). See `brainstorm.md` §1.3 for the full audit if asked to reason about current behavior.
