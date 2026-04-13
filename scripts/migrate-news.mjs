#!/usr/bin/env node

/**
 * Migrates legacy Jekyll _posts/*.md into Astro news content collection.
 * Skips the duplicate " - Copy.md" file and the Maker Faire title typo is fixed.
 * Idempotent — safe to re-run.
 *
 * Usage: node scripts/migrate-news.mjs
 */

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, basename } from 'node:path';

const LEGACY_DIR = './legacy/_posts';
const OUTPUT_DIR = './src/content/news';

/** Parse YAML front matter. */
function parseFrontMatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return { fm: null, body: content };
  const fm = {};
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    fm[key] = val;
  }
  const body = content.slice(match[0].length).trim();
  return { fm, body };
}

/** Extract date from filename like 2013-05-01-slug.md */
function dateFromFilename(filename) {
  const m = filename.match(/^(\d{4}-\d{1,2}-\d{1,2})/);
  if (!m) return null;
  // Normalize to YYYY-MM-DD
  const parts = m[1].split('-');
  return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
}

/** Extract slug from filename. */
function slugFromFilename(filename) {
  return basename(filename, '.md').replace(/^\d{4}-\d{1,2}-\d{1,2}-/, '').toLowerCase();
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const files = (await readdir(LEGACY_DIR)).filter(f => f.endsWith('.md'));
  let migrated = 0;
  let skipped = 0;

  for (const file of files) {
    // Skip the duplicate file
    if (file.includes(' - Copy')) {
      console.log(`  SKIP (duplicate): ${file}`);
      skipped++;
      continue;
    }

    const content = await readFile(join(LEGACY_DIR, file), 'utf-8');
    const { fm, body } = parseFrontMatter(content);

    if (!fm) {
      console.error(`  SKIP: ${file} — no front matter`);
      skipped++;
      continue;
    }

    // Use front-matter date if available, otherwise derive from filename
    let date = fm.date;
    if (!date) {
      date = dateFromFilename(file);
    }
    // Normalize date: strip time/timezone, ensure YYYY-MM-DD
    if (date) {
      date = date.split(' ')[0]; // Drop any time component
      const parts = date.split('-');
      date = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }

    let title = fm.title || '';
    // Fix known typo
    title = title.replace('Makre', 'Maker');

    const slug = slugFromFilename(file);

    const lines = [
      '---',
      `title: ${JSON.stringify(title)}`,
      `date: ${date}`,
      '---',
      '',
      body,
      '',
    ];

    await writeFile(join(OUTPUT_DIR, `${slug}.md`), lines.join('\n'));
    migrated++;
  }

  console.log(`\nNews migration complete: ${migrated} migrated, ${skipped} skipped`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
