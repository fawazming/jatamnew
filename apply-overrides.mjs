/**
 * Apply explicit image overrides (used where the product's own store blocks
 * hotlinking and the automatic alternate match was unavailable or wrong).
 *
 * Usage: node apply-overrides.mjs
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, 'assets', 'img', 'products');
mkdirSync(outDir, { recursive: true });
const map = JSON.parse(readFileSync(resolve(here, 'image-overrides.json'), 'utf8'));

// remove known-wrong automatic picks so the override replaces them
for (const slug of ['yam-flour-10kg', 'plaintain-flour-5kg', 'lasor-chicken']) {
  const p = resolve(outDir, slug + '.jpg');
  if (existsSync(p)) { (await import('node:fs')).unlinkSync(p); console.log('removed', slug); }
}

let ok = 0, fail = 0;
for (const [slug, url] of Object.entries(map)) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JatamShowcase/1.0)' }, redirect: 'follow' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 1000) throw new Error('too small');
    writeFileSync(resolve(outDir, slug + '.jpg'), buf);
    ok++; console.log('✓', slug);
  } catch (e) { fail++; console.log('✗', slug, e.message); }
}
console.log(`\n${ok} overrides applied, ${fail} failed.`);
