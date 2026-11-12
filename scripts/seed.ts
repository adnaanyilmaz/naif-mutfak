// Local-only seed: `npm run db:seed`. Upserts sample content into local D1 and sample PDFs into local R2.
// Never targets --remote.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ingredientsSchema, instructionsSchema } from '../src/validators/content.ts';
import { product, seedPosts } from './seed-data.ts';

const DB_NAME = 'naif-mutfak-db';
const EBOOKS_BUCKET = 'naif-mutfak-ebooks';
const OUT_DIR = join('.wrangler', 'seed');

type SqlValue = string | number | boolean | null | Date | object;

function lit(v: SqlValue): string {
  if (v === null) return 'NULL';
  if (typeof v === 'number') return String(Math.trunc(v));
  if (typeof v === 'boolean') return v ? '1' : '0';
  if (v instanceof Date) return String(Math.floor(v.getTime() / 1000));
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return `'${s.replace(/'/g, "''")}'`;
}

function upsert(table: string, row: Record<string, SqlValue>, conflict: string[]): string {
  const cols = Object.keys(row);
  const updates = cols.filter((c) => !conflict.includes(c)).map((c) => `${c} = excluded.${c}`);
  return (
    `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map((c) => lit(row[c] ?? null)).join(', ')})\n` +
    `  ON CONFLICT(${conflict.join(', ')}) DO UPDATE SET ${updates.join(', ')}, updated_at = unixepoch();`
  );
}

function upsertNoTimestamps(table: string, row: Record<string, SqlValue>, conflict: string[]): string {
  return upsert(table, row, conflict).replace(', updated_at = unixepoch();', ';');
}

function pdfKey(variantId: string): string {
  return `ebooks/${product.id}/${variantId}.pdf`;
}

/** Minimal valid single-page PDF (ASCII text only). */
function samplePdf(label: string): string {
  const text = `Naif Mutfak - ${label} - local sample`;
  const stream = `BT /F1 18 Tf 72 720 Td (${text}) Tj ET`;
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) out += `${String(off).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return out;
}

function buildSql(pdfSizes: Map<string, number>): string {
  const stmts: string[] = [];

  stmts.push(
    upsert(
      'products',
      { id: product.id, slug: product.slug, type: 'ebook', status: 'active', cover_image_key: null, page_count: product.pageCount },
      ['id'],
    ),
  );
  for (const t of product.translations) {
    stmts.push(
      upsertNoTimestamps(
        'product_translations',
        { product_id: product.id, locale: t.locale, title: t.title, subtitle: t.subtitle, description_md: t.descriptionMd, cover_alt: t.coverAlt },
        ['product_id', 'locale'],
      ),
    );
  }
  for (const v of product.variants) {
    stmts.push(
      upsert(
        'product_variants',
        {
          id: v.id,
          product_id: product.id,
          content_locale: v.contentLocale,
          sku: v.sku,
          price_try: product.prices.priceTry,
          price_usd: product.prices.priceUsd,
          price_sar: product.prices.priceSar,
          ls_variant_id: v.ls,
          paddle_price_id: v.paddle,
          pdf_r2_key: pdfKey(v.id),
          pdf_size_bytes: pdfSizes.get(v.id) ?? null,
          is_active: true,
        },
        ['id'],
      ),
    );
  }

  for (const p of seedPosts) {
    stmts.push(
      upsert(
        'posts',
        {
          id: p.id,
          status: 'published',
          category: p.category,
          hero_image_key: null,
          is_recipe: true,
          prep_minutes: p.prepMinutes,
          cook_minutes: p.cookMinutes,
          rest_minutes: p.restMinutes,
          base_servings: p.baseServings,
          difficulty: p.difficulty,
          featured_product_id: product.id,
          published_at: new Date(p.publishedAt),
        },
        ['id'],
      ),
    );
    for (const t of p.translations) {
      // Validate JSON columns on write (same contract as the app).
      const ingredients = ingredientsSchema.parse(t.ingredients);
      const instructions = instructionsSchema.parse(t.instructions);
      stmts.push(
        upsert(
          'post_translations',
          {
            post_id: p.id,
            locale: t.locale,
            slug: t.slug,
            title: t.title,
            dek: t.dek,
            body_md: t.bodyMd,
            hero_image_alt: t.heroImageAlt,
            seo_title: t.seoTitle,
            seo_description: t.seoDescription,
            ingredients_json: ingredients,
            instructions_json: instructions,
            keywords_json: t.keywords,
            cuisine: t.cuisine,
            is_published: true,
          },
          ['post_id', 'locale'],
        ),
      );
    }
  }
  return stmts.join('\n') + '\n';
}

function wrangler(args: string[]): void {
  execFileSync('npx', ['wrangler', ...args], { stdio: 'inherit', shell: process.platform === 'win32' });
}

mkdirSync(OUT_DIR, { recursive: true });

const sizes = new Map<string, number>();
for (const v of product.variants) {
  const pdf = samplePdf(v.sku);
  const file = join(OUT_DIR, `${v.id}.pdf`);
  writeFileSync(file, pdf, 'latin1');
  sizes.set(v.id, Buffer.byteLength(pdf, 'latin1'));
  wrangler(['r2', 'object', 'put', `${EBOOKS_BUCKET}/${pdfKey(v.id)}`, '--local', '--file', file, '--content-type', 'application/pdf']);
}

const sqlFile = join(OUT_DIR, 'seed.sql');
writeFileSync(sqlFile, buildSql(sizes), 'utf8');
wrangler(['d1', 'execute', DB_NAME, '--local', '--file', sqlFile]);

console.log(`Seeded ${seedPosts.length} posts, 1 product (${product.variants.length} variants) into local D1/R2.`);
