#!/usr/bin/env node

/**
 * Migrates legacy Jekyll _publication/*.md files into Astro content collection format.
 * Idempotent — safe to re-run. Logs unmappable records to stderr.
 *
 * Usage: node scripts/migrate-publications.mjs
 */

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, basename, extname } from 'node:path';

const LEGACY_DIR = './legacy/_publication';
const OUTPUT_DIR = './src/content/publications';
const R2_BASE = 'https://pub-6526459aa6b442a7b070a1f0578eb4eb.r2.dev/papers';

/** Parse YAML front matter (simple key: value, no nesting needed). */
function parseFrontMatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  const fm = {};
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    // Strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    fm[key] = val;
  }
  return fm;
}

/** Parse "First Last, First Last, and First Last" into array. */
function parseAuthors(raw) {
  if (!raw) return [];
  // Replace " and " (with surrounding spaces) with comma
  let normalized = raw.replace(/,?\s+and\s+/g, ', ');
  return normalized.split(',').map(s => s.trim()).filter(Boolean);
}

/** Map legacy type to new venueType. */
function mapVenueType(legacyType) {
  switch (legacyType) {
    case 'article': return 'journal';
    case 'conference': return 'conference';
    case 'patent': return 'patent';
    default: return 'preprint';
  }
}

/** Build the venue string from journal or booktitle. */
function getVenue(fm) {
  if (fm.journal && fm.journal.trim()) return fm.journal.trim();
  if (fm.booktitle && fm.booktitle.trim()) return fm.booktitle.trim();
  return undefined;
}

/** Check if a PDF file exists for this publication. */
async function pdfExists(stem) {
  const dir = await readdir(LEGACY_DIR);
  // Check both lowercase .pdf and uppercase .PDF
  return dir.some(f => {
    const name = basename(f, extname(f));
    const ext = extname(f).toLowerCase();
    return name === stem && ext === '.pdf';
  });
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const files = (await readdir(LEGACY_DIR)).filter(f => f.endsWith('.md'));
  const allFiles = await readdir(LEGACY_DIR);
  let migrated = 0;
  let skipped = 0;

  for (const file of files) {
    const stem = basename(file, '.md');
    const content = await readFile(join(LEGACY_DIR, file), 'utf-8');
    const fm = parseFrontMatter(content);

    if (!fm) {
      console.error(`SKIP: ${file} — no front matter found`);
      skipped++;
      continue;
    }

    if (!fm.title || !fm.author || !fm.year) {
      console.error(`SKIP: ${file} — missing required field (title/author/year)`);
      skipped++;
      continue;
    }

    const authors = parseAuthors(fm.author);
    const venueType = mapVenueType(fm.type);
    const venue = getVenue(fm);
    const year = parseInt(fm.year, 10);
    const doi = fm.doi && fm.doi.trim() ? fm.doi.trim() : undefined;
    const note = fm.note && fm.note.trim() ? fm.note.trim() : undefined;
    const sortKey = fm.sort_key && fm.sort_key.trim() ? fm.sort_key.trim() : undefined;
    const topic = fm.topic && fm.topic.trim() ? fm.topic.trim() : undefined;
    const patent = fm.patent && fm.patent.trim() ? fm.patent.trim() : undefined;

    // Check for PDF
    const hasPdf = allFiles.some(f => {
      const name = basename(f, extname(f));
      const ext = extname(f).toLowerCase();
      return name === stem && ext === '.pdf';
    });
    const pdfUrl = hasPdf ? `${R2_BASE}/${stem}.pdf` : undefined;

    // Build new front matter
    const lines = [
      '---',
      `title: ${JSON.stringify(fm.title)}`,
      `authors:`,
      ...authors.map(a => `  - ${JSON.stringify(a)}`),
      `year: ${year}`,
      `venueType: ${venueType}`,
    ];

    if (venue) lines.push(`venue: ${JSON.stringify(venue)}`);
    if (doi) lines.push(`doi: ${JSON.stringify(doi)}`);
    if (pdfUrl) lines.push(`pdf: ${JSON.stringify(pdfUrl)}`);
    if (note) lines.push(`note: ${JSON.stringify(note)}`);
    if (sortKey) lines.push(`sortKey: ${JSON.stringify(sortKey)}`);
    if (patent) lines.push(`patent: ${JSON.stringify(patent)}`);
    if (topic) {
      lines.push(`tags:`);
      lines.push(`  - ${JSON.stringify(topic)}`);
    }

    lines.push('---');
    lines.push('');

    await writeFile(join(OUTPUT_DIR, `${stem}.md`), lines.join('\n'));
    migrated++;
  }

  console.log(`\nPublications migration complete: ${migrated} migrated, ${skipped} skipped`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
