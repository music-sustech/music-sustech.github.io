#!/usr/bin/env node

/**
 * Adds bibKey field to publication frontmatter, derived from the filename stem.
 * Idempotent — skips files that already have bibKey.
 *
 * Usage: node scripts/backfill-bibkey.mjs
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, basename } from 'node:path';

const CONTENT_DIR = './src/content/publications';

async function main() {
  const files = (await readdir(CONTENT_DIR)).filter(f => f.endsWith('.md'));
  let updated = 0;
  let skipped = 0;

  for (const file of files) {
    const stem = basename(file, '.md');
    const filePath = join(CONTENT_DIR, file);
    let content = await readFile(filePath, 'utf-8');

    // Skip if already has bibKey
    if (/^bibKey:/m.test(content)) {
      skipped++;
      continue;
    }

    // Insert bibKey after the opening ---
    content = content.replace(/^---\n/, `---\nbibKey: ${JSON.stringify(stem)}\n`);

    await writeFile(filePath, content);
    updated++;
  }

  console.log(`Backfill complete: ${updated} updated, ${skipped} already had bibKey`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
