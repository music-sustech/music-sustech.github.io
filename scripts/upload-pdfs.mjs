#!/usr/bin/env node

/**
 * Uploads publication PDFs from legacy/_publication/ to Cloudflare R2.
 * Requires R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY env vars.
 *
 * Usage: node scripts/upload-pdfs.mjs
 *
 * Install dependency first: pnpm add -D @aws-sdk/client-s3
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

const LEGACY_DIR = './legacy/_publication';
const BUCKET = 'music-sustech-website';
const ENDPOINT = 'https://835b0abb0d4fc99399a36a0b732630b1.r2.cloudflarestorage.com';
const PREFIX = 'papers';

const { R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;

if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  console.error('Error: R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY must be set.');
  console.error('  export R2_ACCESS_KEY_ID=your-key');
  console.error('  export R2_SECRET_ACCESS_KEY=your-secret');
  process.exit(1);
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

async function objectExists(key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const files = (await readdir(LEGACY_DIR))
    .filter(f => extname(f).toLowerCase() === '.pdf');

  console.log(`Found ${files.length} PDFs to upload.\n`);

  let uploaded = 0;
  let skippedExisting = 0;
  let failed = 0;

  for (const file of files) {
    // Normalize filename to lowercase
    const key = `${PREFIX}/${basename(file, extname(file)).toLowerCase()}.pdf`;

    // Skip if already uploaded
    if (await objectExists(key)) {
      console.log(`  SKIP (exists): ${key}`);
      skippedExisting++;
      continue;
    }

    try {
      const body = await readFile(join(LEGACY_DIR, file));
      await s3.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: body,
        ContentType: 'application/pdf',
      }));
      console.log(`  OK: ${file} -> ${key}`);
      uploaded++;
    } catch (err) {
      console.error(`  FAIL: ${file} — ${err.message}`);
      failed++;
    }
  }

  console.log(`\nUpload complete: ${uploaded} uploaded, ${skippedExisting} already existed, ${failed} failed`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
