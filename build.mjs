/**
 * Build the single-file, self-hosted Jatam showcase from products.csv.
 *
 * - reads ../products/products.csv (the exact import catalogue)
 * - merges the richer research fields from ../products/data/sourced-products.json
 *   (unit, allergens, shipping, returns, match status, source URL …) by slug
 * - embeds every downloaded product image as a data URI so the output is truly
 *   self-contained: one HTML file with images included
 *
 * Usage:  node build.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const productsDir = resolve(here, '..', 'products');
const imgDir = resolve(here, 'assets', 'img', 'products');
const outPath = resolve(here, 'index.html');

/* ---------------------------------------------------------------- CSV parse */
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

const csvRows = parseCsv(readFileSync(resolve(productsDir, 'products.csv'), 'utf8'));
const rich = JSON.parse(readFileSync(resolve(productsDir, 'data', 'sourced-products.json'), 'utf8'));

const richBySlug = new Map(rich.products.map(p => [p.slug, p]));
const num = v => (v === '' || v == null ? null : Number(v));

function parseAttributes(str) {
  const out = {};
  String(str || '').split('|').forEach(part => {
    const i = part.indexOf(':');
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  });
  return out;
}

/* Strip every reference to a reference store from customer-facing text. */
const SOURCE_SCRUB = [
  [/not specified by the source store\s*[—-]\s*check the product label\./gi, 'Not specified — always check the product label.'],
  [/not specified by the source store/gi, 'Not specified'],
  [/Surulere\s*Foods?/gi, 'Jatam'],
  [/SurulereFoods/gi, 'Jatam'],
  [/Ogbongeh/gi, 'Jatam'],
  [/Wosiwosi/gi, 'Jatam'],
  [/Afrobuy/gi, 'Jatam'],
  [/Beeola\s*Foods?/gi, 'Jatam'],
  [/Beeola/gi, 'Jatam']
];
function scrub(value) {
  let s = String(value == null ? '' : value);
  for (const [re, to] of SOURCE_SCRUB) s = s.replace(re, to);
  return s.replace(/\bJatam(\s+Jatam)+\b/gi, 'Jatam').replace(/[ \t]{2,}/g, ' ').trim();
}

function dataUri(slug) {
  const file = resolve(imgDir, `${slug}.jpg`);
  if (!existsSync(file)) return null;
  return 'data:image/jpeg;base64,' + readFileSync(file).toString('base64');
}

const products = csvRows.map(row => {
  const slug = row.slug || row.sku.toLowerCase();
  const r = richBySlug.get(slug) || {};
  const attrs = parseAttributes(row.attributes);
  const price = num(row.price);
  const sale = num(row.sale_price);
  // Never ship the reference store's name as a brand.
  const vendorRaw = String(row.vendor || '').trim();
  const vendor = /wosiwosi|ogbongeh|surulere|afrobuy|beeola|jatam|afrobuybea/i.test(vendorRaw) ? '' : scrub(vendorRaw);
  return {
    // customer-facing catalogue fields only — no sourcing metadata is shipped
    name: scrub(row.name),
    sku: row.sku,
    slug,
    vendor,
    product_type: row.product_type,
    short_description: scrub(row.short_description),
    description: scrub(row.description),
    price,
    sale_price: sale,
    cost: num(row.cost),
    stock_quantity: num(row.stock_quantity) ?? 0,
    low_stock_threshold: num(row.low_stock_threshold) ?? 5,
    status: row.status || 'active',
    featured: row.featured === '1' || row.featured === 'true',
    categories: scrub(row.categories || row.product_type),
    collections: scrub(row.collections),
    tags: scrub(row.tags),
    seo_title: scrub(row.seo_title),
    seo_description: scrub(row.seo_description),
    unit: scrub(r.unit || attrs.Unit || ''),
    allergens: scrub(r.allergens || attrs.Allergens || ''),
    category: scrub(r.category || row.product_type),
    compare_at_price: r.compare_at_price ?? null,
    currency: r.currency || 'GBP',
    image: dataUri(slug)
  };
});

const data = {
  generated_at: new Date().toISOString(),
  summary: {
    products: products.length,
    with_image: products.filter(p => p.image).length
  },
  products
};

const template = readFileSync(resolve(here, 'template.html'), 'utf8');
const json = JSON.stringify(data).replace(/</g, '\\u003c');
if (!template.includes('__JATAM_DATA__')) throw new Error('template.html is missing __JATAM_DATA__');
const html = template.replace('__JATAM_DATA__', json);
writeFileSync(outPath, html, 'utf8');

const mb = (Buffer.byteLength(html) / 1048576).toFixed(2);
console.log(`Built index.html — ${products.length} products (${data.summary.with_image} with embedded image), ${mb} MB.`);
