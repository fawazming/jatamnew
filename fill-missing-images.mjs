/**
 * Fill images for products whose own source store blocks hotlinking
 * (ogbongeh.com sits behind a captcha). For each such product we look for a
 * very close match in the other reference catalogues and download that image.
 *
 * Conservative rules: the candidate must share the brand token and the exact
 * pack size (same unit family), and have a high title-token overlap.
 *
 * Usage: node fill-missing-images.mjs
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const productsDir = resolve(here, '..', 'products');
const outDir = resolve(here, 'assets', 'img', 'products');
mkdirSync(outDir, { recursive: true });

/* ---- CSV parse -------------------------------------------------------- */
function parseCsv(text) {
  const rows = []; let row = []; let cur = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (c !== '\r') cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  const head = rows.shift();
  return rows.filter(r => r.length > 1).map(r => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}
const csv = parseCsv(readFileSync(resolve(productsDir, 'products.csv'), 'utf8'));

/* ---- catalogues ------------------------------------------------------- */
const files = readdirSync(resolve(productsDir, 'data', 'raw')).filter(f => f.endsWith('.json') && !f.startsWith('_'));
const pool = [];
for (const f of files) {
  const store = f.replace('.json', '');
  if (store === 'ogbongeh') continue; // blocked host
  const list = JSON.parse(readFileSync(resolve(productsDir, 'data', 'raw', f), 'utf8'));
  for (const p of list) {
    const images = (p.images || []).map(i => typeof i === 'string' ? i : i.src).filter(Boolean);
    if (!images.length) continue;
    pool.push({ store, title: p.title || p.name || '', images });
  }
}

const STOP = new Set(['the','and','with','for','of','pack','box','single','per','ml','kg','g','l','cl','bottle','can','tin','bag','size']);
const GENERIC = new Set(['nigerian','african','fresh','authentic','premium','white','red','yellow','brown','green','classic','original','large','small','big','best']);
const norm = s => String(s).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
const tokens = s => norm(s).split(' ').filter(t => t.length >= 3 && !STOP.has(t) && !/^\d/.test(t));
const leadToken = s => tokens(s).find(t => !GENERIC.has(t)) || tokens(s)[0] || '';
function sizeSig(s) {
  const m = String(s).toLowerCase().match(/(\d+(?:[.,]\d+)?)\s*(kg|g|ml|cl|l|litre|liter|ltrs?)/);
  if (!m) return null;
  const v = parseFloat(m[1].replace(',', '.'));
  const u = m[2];
  const fam = (u === 'kg' || u === 'g') ? 'mass' : 'vol';
  let base;
  if (fam === 'mass') base = u === 'kg' ? v * 1000 : v;
  else base = u === 'cl' ? v * 10 : (u === 'ml' ? v : v * 1000);
  return { fam, base };
}
function overlap(a, b) {
  const A = new Set(a), B = new Set(b);
  let inter = 0; A.forEach(t => { if (B.has(t)) inter++; });
  const uni = new Set([...a, ...b]).size;
  return uni ? inter / uni : 0;
}
function fetchImage(url) {
  return fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JatamShowcase/1.0)' }, redirect: 'follow' })
    .then(r => r.ok ? r.arrayBuffer() : null).catch(() => null);
}

let filled = 0, skipped = 0;
for (const row of csv) {
  const slug = row.slug;
  const target = resolve(outDir, `${slug}.jpg`);
  if (existsSync(target)) { skipped++; continue; }
  const name = row.name;
  const lead = leadToken(name);
  const size = sizeSig(name);
  if (!lead) continue;

  const cands = pool.map(p => {
    const ct = tokens(p.title);
    const cs = sizeSig(p.title);
    if (size) {
      if (!cs || cs.fam !== size.fam || Math.abs(cs.base - size.base) / size.base > 0.05) return null;
    }
    const shared = tokens(name).filter(t => ct.includes(t));
    const leadOk = ct.includes(lead);
    if (!leadOk && shared.length < 3) return null;
    const ov = overlap(tokens(name), ct);
    if (ov < 0.3 && shared.length < 3) return null;
    return { p, ov, shared: shared.length };
  }).filter(Boolean).sort((a, b) => b.shared - a.shared || b.ov - a.ov);

  if (!cands.length) { console.log(`— ${slug}: no close alternate`); continue; }
  const best = cands[0];
  let saved = false;
  for (const url of best.p.images) {
    const buf = await fetchImage(url);
    if (buf) { writeFileSync(target, Buffer.from(buf)); saved = true; break; }
  }
  if (saved) {
    filled++;
    console.log(`✓ ${slug}  ←  ${best.p.store}: "${best.p.title}"  (overlap ${best.ov.toFixed(2)})`);
  } else {
    console.log(`✗ ${slug}: alternate image download failed`);
  }
}
console.log(`\nFilled ${filled}, already present ${skipped}.`);
