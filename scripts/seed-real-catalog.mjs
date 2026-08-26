// Seeds the real MERRIER launch catalog (2 Acid Washed Oversized Tees) —
// distinct from prisma/seed.ts, which only creates placeholder demo
// products with picsum.photos stock images. This script's images point at
// the real product photos already committed under public/products/, so it
// only needs to run once against a fresh database (e.g. Railway production)
// to bring the storefront's real inventory online — no re-uploading, no
// re-entering everything through the admin UI.
//
// Plain .mjs (not TypeScript via tsx) so it runs with just `node`, no
// devDependency needed — safe to run from Railway's own service Console,
// which already has the right MERRIER_DATABASE_URL set, no credentials to
// copy around.
//
// Usage: npm run db:seed-catalog
// Safe to re-run: each product is skipped (not duplicated) if its slug
// already exists.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const category = await prisma.category.upsert({
    where: { slug: 'apparel' },
    update: {},
    create: { name: 'Apparel', slug: 'apparel' },
  });

  const products = [
    {
      name: 'Black Acid Washed Oversized T-Shirt',
      slug: 'black-acid-washed-oversized-tee',
      description:
        'Acid washed, heavyweight cotton, boxy oversized fit with a raw distressed neckline. "You Choose A Right Merries" woven neck tag.',
      images: [
        { url: '/products/black-acid-washed-oversized-tee/01-tag-frayed-collar.png', altText: 'Black Acid Washed Oversized T-Shirt — neck tag, frayed collar', colorValue: 'Black' },
        { url: '/products/black-acid-washed-oversized-tee/02-tag-ribbed-collar.png', altText: 'Black Acid Washed Oversized T-Shirt — neck tag, ribbed collar', colorValue: 'Black' },
        { url: '/products/black-acid-washed-oversized-tee/03-neck-seam-frayed.jpg', altText: 'Black Acid Washed Oversized T-Shirt — frayed neck seam', colorValue: 'Black' },
        { url: '/products/black-acid-washed-oversized-tee/04-neck-seam.jpg', altText: 'Black Acid Washed Oversized T-Shirt — neck seam detail', colorValue: 'Black' },
        { url: '/products/black-acid-washed-oversized-tee/05-fabric-fold.jpg', altText: 'Black Acid Washed Oversized T-Shirt — fabric texture', colorValue: 'Black' },
        { url: '/products/black-acid-washed-oversized-tee/06-sleeve-hem.jpg', altText: 'Black Acid Washed Oversized T-Shirt — sleeve hem detail', colorValue: 'Black' },
      ],
      variants: [
        { size: 'S', color: 'Black', colorHex: '#1a1a1a', sku: 'MR-ACIDTEE-BLK-S', price: 44900, stock: 15 },
        { size: 'M', color: 'Black', colorHex: '#1a1a1a', sku: 'MR-ACIDTEE-BLK-M', price: 44900, stock: 0 },
        { size: 'L', color: 'Black', colorHex: '#1a1a1a', sku: 'MR-ACIDTEE-BLK-L', price: 44900, stock: 0 },
        { size: 'XL', color: 'Black', colorHex: '#1a1a1a', sku: 'MR-ACIDTEE-BLK-XL', price: 44900, stock: 4 },
        { size: 'XXL', color: 'Black', colorHex: '#1a1a1a', sku: 'MR-ACIDTEE-BLK-XXL', price: 44900, stock: 2 },
      ],
    },
    {
      name: 'Beige Acid Washed Oversized T-Shirt',
      slug: 'beige-acid-washed-oversized-tee',
      description:
        'Acid washed, heavyweight cotton, boxy oversized fit with a raw distressed neckline. "You Choose A Right Merries" woven neck tag.',
      images: [
        { url: '/products/beige-acid-washed-oversized-tee/01-collar-seam.jpg', altText: 'Beige Acid Washed Oversized T-Shirt — collar seam detail', colorValue: 'Beige' },
        { url: '/products/beige-acid-washed-oversized-tee/02-neck-tag.png', altText: 'Beige Acid Washed Oversized T-Shirt — neck tag', colorValue: 'Beige' },
        { url: '/products/beige-acid-washed-oversized-tee/03-hem-overlock.jpg', altText: 'Beige Acid Washed Oversized T-Shirt — hem overlock stitch', colorValue: 'Beige' },
        { url: '/products/beige-acid-washed-oversized-tee/04-sleeve-hem.jpg', altText: 'Beige Acid Washed Oversized T-Shirt — sleeve hem detail', colorValue: 'Beige' },
      ],
      variants: [
        { size: 'S', color: 'Beige', colorHex: '#a3865f', sku: 'MR-ACIDTEE-BEI-S', price: 44900, stock: 4 },
        { size: 'M', color: 'Beige', colorHex: '#a3865f', sku: 'MR-ACIDTEE-BEI-M', price: 44900, stock: 0 },
        { size: 'L', color: 'Beige', colorHex: '#a3865f', sku: 'MR-ACIDTEE-BEI-L', price: 44900, stock: 3 },
        { size: 'XL', color: 'Beige', colorHex: '#a3865f', sku: 'MR-ACIDTEE-BEI-XL', price: 44900, stock: 3 },
        { size: 'XXL', color: 'Beige', colorHex: '#a3865f', sku: 'MR-ACIDTEE-BEI-XXL', price: 44900, stock: 1 },
      ],
    },
  ];

  for (const p of products) {
    const existing = await prisma.product.findUnique({ where: { slug: p.slug } });
    if (existing) {
      console.log(`"${p.name}" already exists — skipping.`);
      continue;
    }

    await prisma.product.create({
      data: {
        name: p.name,
        slug: p.slug,
        description: p.description,
        status: 'ACTIVE',
        categoryId: category.id,
        images: { create: p.images.map((img, i) => ({ ...img, position: i })) },
        variants: { create: p.variants },
      },
    });
    console.log(`Created "${p.name}".`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
