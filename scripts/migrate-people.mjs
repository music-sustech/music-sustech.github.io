#!/usr/bin/env node

/**
 * Migrates legacy people/index.md (monolithic HTML) into per-person Astro content files.
 * Also copies people images to src/assets/people/.
 * Idempotent — safe to re-run.
 *
 * Usage: node scripts/migrate-people.mjs
 */

import { readFile, writeFile, mkdir, cp, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

const LEGACY_FILE = './legacy/people/index.md';
const LEGACY_IMAGES = './legacy/people/images';
const OUTPUT_DIR = './src/content/people';
const ASSETS_DIR = './src/assets/people';

/** Generate a slug from a name. */
function slugify(name) {
  return name.toLowerCase()
    .replace(/['".,()]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Extract image filename from an img src. */
function extractImageFilename(src) {
  if (!src) return null;
  const match = src.match(/images\/([^'"]+)/);
  return match ? match[1] : null;
}

/** Write a person file. */
async function writePerson({ name, role, status, photo, email, bio, joined, left, currentPosition, degree }) {
  const slug = slugify(name);
  const lines = ['---'];
  lines.push(`name: ${JSON.stringify(name)}`);
  lines.push(`role: ${JSON.stringify(role)}`);
  lines.push(`status: ${JSON.stringify(status)}`);
  if (photo) lines.push(`photo: ${JSON.stringify(`../../assets/people/${photo}`)}`);
  if (email) {
    lines.push(`email: ${JSON.stringify(email)}`);
    lines.push(`showEmail: true`);
  }
  if (joined) lines.push(`joined: ${JSON.stringify(joined)}`);
  if (left) lines.push(`left: ${JSON.stringify(left)}`);
  if (currentPosition) lines.push(`currentPosition: ${JSON.stringify(currentPosition)}`);
  if (bio) lines.push(`bio: ${JSON.stringify(bio)}`);
  lines.push('---');
  lines.push('');

  await writeFile(join(OUTPUT_DIR, `${slug}.md`), lines.join('\n'));
  return slug;
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  await mkdir(ASSETS_DIR, { recursive: true });

  // Copy people images
  if (existsSync(LEGACY_IMAGES)) {
    const imgs = await readdir(LEGACY_IMAGES);
    for (const img of imgs) {
      const src = join(LEGACY_IMAGES, img);
      const dest = join(ASSETS_DIR, img);
      // Skip subdirectories
      try {
        await cp(src, dest);
      } catch {
        // skip directories
      }
    }
    console.log(`  Copied people images to ${ASSETS_DIR}`);
  }

  const content = await readFile(LEGACY_FILE, 'utf-8');
  let migrated = 0;

  // --- PI ---
  await writePerson({
    name: 'Xiaoguang "Leo" Liu',
    role: 'pi',
    status: 'current',
    photo: 'liu2015s.jpg',
    email: 'liuxg@sustech.edu.cn',
    joined: '2021-03',
    bio: 'Prof. Xiaoguang Liu received his Bachelor\'s degree from Zhejiang University, China, in 2004 and Ph.D. degree from Purdue University, USA, in 2010. He joined the Department of Electrical and Computer Engineering, University of California, Davis in Nov. 2011 as an assistant professor and was promoted to associate professor in Jul. 2017. In Mar. 2021, he joined the School of Microelectronics (SME), Southern University of Science and Technology (SUSTech) in Shenzhen, China, as a full professor.',
  });
  migrated++;

  // --- Research Associate/Assistant Professors → postdoc ---
  const researchFaculty = [
    { name: 'Xiaohu Wu', photo: 'xiaohu_v2.jpg' },
    { name: 'Dashuai Wang', photo: 'wangdashuai.jpg' },
    { name: 'Xuan Ma', photo: 'maxuan.jpg' },
  ];
  for (const p of researchFaculty) {
    await writePerson({ name: p.name, role: 'postdoc', status: 'current', photo: p.photo, joined: '2021' });
    migrated++;
  }

  // --- PhD Students ---
  const phdStudents = [
    { name: 'Yongxin Cheng', photo: 'chengyongxin.jpg' },
    { name: 'Shenghao Liu', photo: 'liushenghao.png' },
  ];
  for (const p of phdStudents) {
    await writePerson({ name: p.name, role: 'phd', status: 'current', photo: p.photo, joined: '2021' });
    migrated++;
  }

  // --- Master Students ---
  const masterStudents = [
    { name: 'Danlu Zhang', photo: 'zhangdanlu.jpg', joined: '2022' },
    { name: 'Caihong Liu', photo: 'liucaihong.jpg', joined: '2022' },
    { name: 'Mandong Zhang', photo: 'zhangmandong.png', joined: '2022' },
    { name: 'Jingdong Zhang', photo: 'zhangjingdong.jpg', joined: '2021' },
    { name: 'Tianye Wen', photo: 'wentianye.jpg', joined: '2021' },
  ];
  for (const p of masterStudents) {
    await writePerson({ name: p.name, role: 'masters', status: 'current', photo: p.photo, joined: p.joined });
    migrated++;
  }

  // --- Undergraduate Students ---
  const undergradStudents = [
    { name: 'Weitong Tian', photo: 'tianweitong.jpg', joined: '2021' },
    { name: 'Yuheng Cao', photo: 'caoyuheng.png', joined: '2021' },
    { name: 'Boye Jiang', photo: 'jiangboye.jpg', joined: '2021' },
    { name: 'Qishu Luo', photo: 'luoqishu.png', joined: '2021' },
    { name: 'Xizhi Wang', photo: 'wangxizhi.png', joined: '2020' },
    { name: 'Yutang Zhou', photo: 'zhouyutang.jpg', joined: '2020' },
  ];
  for (const p of undergradStudents) {
    await writePerson({ name: p.name, role: 'undergrad', status: 'current', photo: p.photo, joined: p.joined });
    migrated++;
  }

  // --- Visiting ---
  await writePerson({ name: 'Zhuolin Li', role: 'visiting', status: 'current', photo: 'lizhuolin.jpg', joined: '2021' });
  migrated++;

  // --- Alumni (from the markdown table) ---
  const alumniRaw = content.match(/\| Name \| Year \| Degree \| Notes \|\n\| :--- \|:---\|:---:\|:----------\|\n([\s\S]*)/);
  if (alumniRaw) {
    const rows = alumniRaw[1].split('\n').filter(r => r.startsWith('|'));
    for (const row of rows) {
      const cols = row.split('|').map(c => c.trim()).filter(Boolean);
      if (cols.length < 3) continue;

      // Clean name: strip markdown links
      let name = cols[0].replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim();
      // Handle multi-person entries: split on " and " or ", "
      const names = name.split(/,\s*(?=[A-Z])/).flatMap(n => n.split(/\s+and\s+/));

      const yearRange = cols[1].trim();
      const degree = cols[2].trim();
      const notes = cols[3] ? cols[3].replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim() : '';

      // Parse year range for joined/left
      const yearMatch = yearRange.match(/(\d{4})\s*[-–]\s*(\d{4})/);
      const singleYear = yearRange.match(/^(\d{4})/);
      const joined = yearMatch ? yearMatch[1] : (singleYear ? singleYear[1] : yearRange);
      const left = yearMatch ? yearMatch[2] : (singleYear ? singleYear[1] : undefined);

      // Map degree to role
      let role = 'undergrad';
      const degreeLower = degree.toLowerCase();
      if (degreeLower.includes('postdoc') || degreeLower.includes('post-doc')) role = 'postdoc';
      else if (degreeLower.includes('phd') || degreeLower.includes('ph.d')) role = 'phd';
      else if (degreeLower.includes('ms') || degreeLower.includes('m.s') || degreeLower.includes('master')) role = 'masters';
      else if (degreeLower.includes('undergrad') || degreeLower.includes('high school')) role = 'undergrad';
      else if (degreeLower.includes('visit')) role = 'visiting';

      for (const n of names) {
        const cleanName = n.trim();
        if (!cleanName || cleanName.length < 2) continue;

        await writePerson({
          name: cleanName,
          role,
          status: 'alumni',
          joined,
          left,
          currentPosition: notes || undefined,
        });
        migrated++;
      }
    }
  }

  console.log(`\nPeople migration complete: ${migrated} persons migrated`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
