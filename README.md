# Jatam — live storefront preview

A self-hosted storefront preview for Jatam Food Distribution. Open
[`index.html`](index.html) — the catalogue, product photos and all UI are in the file;
the landing-page photography is referenced from `assets/img/landing/`.

```
standalone/
├── index.html            ← open this
└── assets/img/landing/   ← hero, category, banner, country and social images
```

Keep the folder together when hosting (any static host works).

## What's inside

- **127 products**, each with its own photo — **123 real product photos embedded**
  directly in `index.html`, and 4 branded placeholders where no usable source image
  existed.
- **Landing-page imagery** supplied by the client, optimised and wired into the hero,
  the 5 category tiles, the 3 promo banners, the 4 country tiles and the "Why Jatam"
  feature cards.
- **No sourcing metadata is shipped or displayed.** Reference-store names, source
  URLs, match status/confidence, vendor/source chips and the research data explorer
  have been removed. Product descriptions are scrubbed so no reference store is
  mentioned anywhere on the site.
- Basket, slide-in cart, search with suggestions, category filtering, sorting and a
  demo checkout all work with vanilla JS (no build step to run the site).

## Views

| Route | Contents |
|---|---|
| `#/` | Hero, categories, deals, live catalogue, promo banners, best sellers, why Jatam, country tiles, delivery & returns |
| `#/shop` | Full catalogue with category filter, text filter, sort and load-more |
| `#/product/<slug>` | Product page — photo, price/sale, pack size, availability, highlights, details, allergens, storage, delivery & returns, related items |
| `#/delivery` | Jatam delivery and returns information |
| `#/about` | About the brand |
| `#/checkout` | Basket summary and demo confirmation |

## Product page — how fields are used

The product page is customer-facing rather than a data dump:

- **Shown:** name, real product brand (only when it isn't a reference store), price,
  sale price, pack size/unit, availability, short description, full description,
  category, SKU, allergens, storage guidance, delivery & returns, customer-friendly
  tags (vegan, gluten-free, halal, high-protein…).
- **Hidden:** source store, source URL, source category/SKU, match status/confidence,
  sourcing notes, internal attributes, raw image URLs, cost and stock internals.

## Landing images

The supplied originals live in `assets/img/` (kept out of git). `prepare-landing-images.php`
cover-crops them to the sizes the layout needs and writes the web-ready files to
`assets/img/landing/`:

```bash
php prepare-landing-images.php
```

## Rebuild the single file

```bash
node build.mjs
```

`build.mjs` reads `../products/products.csv`, merges the pack size/allergens fields,
strips all sourcing metadata, embeds the product photos and writes `index.html`.
Landing images are referenced by path, so keep `assets/img/landing/` beside the file.

## Product images

`fetch-images.php` downloads each product photo from the catalogue, resizes it and saves
it under `assets/img/products/`; `build.mjs` inlines those as data URIs. Products with no
usable photo fall back to an on-brand generated placeholder, so there are no broken
images.

```bash
php fetch-images.php
node fill-missing-images.mjs
node apply-overrides.mjs
node build.mjs
```

> Preview only: checkout, basket and forms are demonstrative. Prices are a point-in-time
> snapshot.
