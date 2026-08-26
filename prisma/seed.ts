import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const category = await prisma.category.upsert({
    where: { slug: 'apparel' },
    update: {},
    create: { name: 'Apparel', slug: 'apparel' },
  });

  const existing = await prisma.product.findUnique({ where: { slug: 'merrier-hoodie' } });
  if (existing) {
    console.log('Seed data already present — skipping.');
    return;
  }

  await prisma.product.create({
    data: {
      name: 'The Merrier Hoodie',
      slug: 'merrier-hoodie',
      description:
        'Heavyweight fleece, kangaroo pocket, "Choose Your Merrier" across the chest. Part of the Winter Collection.\n\nPlaceholder catalog entry — replace price, stock and photos with real values before launch.',
      status: 'ACTIVE',
      categoryId: category.id,
      images: {
        create: [
          { url: 'https://picsum.photos/seed/merrier-hoodie-black/900/1125', altText: 'Merrier Hoodie — Black', colorValue: 'Black', position: 0 },
          { url: 'https://picsum.photos/seed/merrier-hoodie-white/900/1125', altText: 'Merrier Hoodie — White', colorValue: 'White', position: 1 },
        ],
      },
      variants: {
        create: [
          { size: 'S', color: 'Black', colorHex: '#1c1712', sku: 'MR-HOOD-BLK-S', price: 165000, compareAtPrice: null, stock: 8 },
          { size: 'M', color: 'Black', colorHex: '#1c1712', sku: 'MR-HOOD-BLK-M', price: 165000, compareAtPrice: null, stock: 12 },
          { size: 'L', color: 'Black', colorHex: '#1c1712', sku: 'MR-HOOD-BLK-L', price: 165000, compareAtPrice: null, stock: 0 },
          { size: 'S', color: 'White', colorHex: '#ece5d8', sku: 'MR-HOOD-WHT-S', price: 165000, compareAtPrice: null, stock: 5 },
          { size: 'M', color: 'White', colorHex: '#ece5d8', sku: 'MR-HOOD-WHT-M', price: 165000, compareAtPrice: null, stock: 2 },
        ],
      },
    },
  });

  await prisma.product.create({
    data: {
      name: 'Denim Overshirt',
      slug: 'denim-overshirt',
      description:
        'Washed indigo, boxy fit, chest pocket — the layer that opens every look.\n\nPlaceholder catalog entry — replace price, stock and photos with real values before launch.',
      status: 'ACTIVE',
      categoryId: category.id,
      images: {
        create: [{ url: 'https://picsum.photos/seed/merrier-denim/900/1125', altText: 'Denim Overshirt', position: 0 }],
      },
      variants: {
        create: [
          { size: 'M', color: 'Indigo', colorHex: '#3b5a7a', sku: 'MR-DENIM-IND-M', price: 189000, compareAtPrice: 219000, stock: 6 },
          { size: 'L', color: 'Indigo', colorHex: '#3b5a7a', sku: 'MR-DENIM-IND-L', price: 189000, compareAtPrice: 219000, stock: 3 },
        ],
      },
    },
  });

  console.log('Seeded 2 products.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
