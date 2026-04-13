#!/usr/bin/env node

/**
 * Renames PDFs on R2 by copying to new key and deleting the old one.
 * Reads the rename list from scripts/r2-renames.json.
 * Requires R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY env vars.
 *
 * Usage: node scripts/rename-r2-pdfs.mjs
 */

import { readFile } from 'node:fs/promises';
import { S3Client, CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const BUCKET = 'music-sustech-website';
const ENDPOINT = 'https://835b0abb0d4fc99399a36a0b732630b1.r2.cloudflarestorage.com';

const { R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;

if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  console.error('Error: R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY must be set.');
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

async function main() {
  const renames = JSON.parse(await readFile('./scripts/r2-renames.json', 'utf-8'));
  console.log(`${renames.length} PDFs to rename on R2.\n`);

  let renamed = 0;
  let failed = 0;

  for (const { from, to } of renames) {
    try {
      // Copy to new key
      await s3.send(new CopyObjectCommand({
        Bucket: BUCKET,
        CopySource: `${BUCKET}/${from}`,
        Key: to,
      }));

      // Delete old key
      await s3.send(new DeleteObjectCommand({
        Bucket: BUCKET,
        Key: from,
      }));

      console.log(`  OK: ${from} -> ${to}`);
      renamed++;
    } catch (err) {
      console.error(`  FAIL: ${from} -> ${to} — ${err.message}`);
      failed++;
    }
  }

  console.log(`\nRename complete: ${renamed} renamed, ${failed} failed`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
