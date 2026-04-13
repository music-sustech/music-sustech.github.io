#!/usr/bin/env node

/**
 * Fixes publication files missing the letter suffix.
 * Renames local .md files and updates pdf URLs in frontmatter.
 * Also generates R2 rename commands.
 *
 * Usage: node scripts/fix-bibkey-suffix.mjs
 */

import { readdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join, basename } from 'node:path';

const CONTENT_DIR = './src/content/publications';
const R2_BASE = 'https://pub-6526459aa6b442a7b070a1f0578eb4eb.r2.dev/papers';

async function main() {
  const files = (await readdir(CONTENT_DIR)).filter(f => f.endsWith('.md'));
  const r2Renames = [];
  let fixed = 0;

  for (const file of files) {
    const stem = basename(file, '.md');

    // Skip if already ends with a letter
    if (/[a-z]$/i.test(stem)) continue;
    // Only fix if it ends with a digit
    if (!/\d$/.test(stem)) continue;

    const newStem = stem + 'a';
    const newFile = newStem + '.md';

    // Read and update frontmatter
    let content = await readFile(join(CONTENT_DIR, file), 'utf-8');

    // Update pdf URL if present
    const oldPdfUrl = `${R2_BASE}/${stem}.pdf`;
    const newPdfUrl = `${R2_BASE}/${newStem}.pdf`;
    if (content.includes(oldPdfUrl)) {
      content = content.replace(oldPdfUrl, newPdfUrl);
      r2Renames.push({ from: `papers/${stem}.pdf`, to: `papers/${newStem}.pdf` });
    }

    // Write updated content to new filename
    await writeFile(join(CONTENT_DIR, newFile), content);

    // Remove old file (by overwriting we already have the new one)
    const { unlink } = await import('node:fs/promises');
    await unlink(join(CONTENT_DIR, file));

    fixed++;
  }

  console.log(`Fixed ${fixed} publication files (appended 'a' suffix)\n`);

  if (r2Renames.length > 0) {
    console.log(`${r2Renames.length} PDFs need renaming on R2.`);
    console.log(`Run: node scripts/rename-r2-pdfs.mjs\n`);

    // Write the rename list for the R2 script
    const renameData = JSON.stringify(r2Renames, null, 2);
    await writeFile('./scripts/r2-renames.json', renameData);
    console.log(`Rename list written to scripts/r2-renames.json`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
