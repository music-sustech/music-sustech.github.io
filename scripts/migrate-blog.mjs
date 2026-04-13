#!/usr/bin/env node

/**
 * Migrates legacy Jekyll _blog/*.md into Astro blog content collection.
 * Skips unpublished drafts. Copies associated images.
 * Idempotent — safe to re-run.
 *
 * Usage: node scripts/migrate-blog.mjs
 */

import { readdir, readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { existsSync } from 'node:fs';

const LEGACY_DIR = './legacy/_blog';
const OUTPUT_DIR = './src/content/blog';
const ASSETS_DIR = './src/assets/blog';

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

function slugFromFilename(filename) {
  return basename(filename, '.md').replace(/^\d{4}-\d{1,2}-\d{1,2}-/, '').toLowerCase();
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  await mkdir(ASSETS_DIR, { recursive: true });

  // Copy blog images if they exist
  const imgDir = join(LEGACY_DIR, 'high-efficiency-oscillator');
  if (existsSync(imgDir)) {
    const destImgDir = join(ASSETS_DIR, 'high-efficiency-oscillator');
    await mkdir(destImgDir, { recursive: true });
    const imgs = await readdir(imgDir);
    for (const img of imgs) {
      await cp(join(imgDir, img), join(destImgDir, img));
    }
    console.log(`  Copied ${imgs.length} blog images to ${destImgDir}`);
  }

  const files = (await readdir(LEGACY_DIR)).filter(f => f.endsWith('.md'));
  let migrated = 0;
  let skipped = 0;

  for (const file of files) {
    const content = await readFile(join(LEGACY_DIR, file), 'utf-8');
    const { fm, body } = parseFrontMatter(content);

    if (!fm) {
      console.error(`  SKIP: ${file} — no front matter`);
      skipped++;
      continue;
    }

    // Skip unpublished drafts
    if (fm.published === 'false') {
      console.log(`  SKIP (draft): ${file}`);
      skipped++;
      continue;
    }

    // Extract date, strip timezone
    let date = fm.date ? fm.date.split(' ')[0] : null;
    if (!date) {
      console.error(`  SKIP: ${file} — no date`);
      skipped++;
      continue;
    }

    const title = fm.title || '';
    const slug = slugFromFilename(file);

    // Rewrite image paths from relative to asset reference
    let processedBody = body;
    // Replace ![alt](high-efficiency-oscillator/foo.png) with updated path
    processedBody = processedBody.replace(
      /!\[([^\]]*)\]\(high-efficiency-oscillator\/([^)]+)\)/g,
      '![$1](../../assets/blog/high-efficiency-oscillator/$2)'
    );

    // Strip <!--more--> markers
    processedBody = processedBody.replace(/<!--more-->/g, '');

    const lines = [
      '---',
      `title: ${JSON.stringify(title)}`,
      `date: ${date}`,
      `author: "Xiaoguang Liu"`,
      `tags:`,
      `  - "oscillator-design"`,
      `  - "mmW/THz"`,
      '---',
      '',
      processedBody,
      '',
    ];

    await writeFile(join(OUTPUT_DIR, `${slug}.md`), lines.join('\n'));
    migrated++;
  }

  console.log(`\nBlog migration complete: ${migrated} migrated, ${skipped} skipped`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
