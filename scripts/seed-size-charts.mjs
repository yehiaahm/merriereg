// Loads the owner-supplied size charts (scripts/size-chart-data.mjs) into the
// database as VERIFIED charts and makes them the default for the listed
// categories — this is what switches "Find my size" on for those products.
//
// Plain .mjs (no tsx needed) so it runs from Railway's service Console, which
// already has the right MERRIER_DATABASE_URL, like scripts/seed-real-catalog.mjs.
//
// Usage: npm run db:seed-size-charts
// Safe to re-run: charts are matched by name and updated in place, and a
// category is only pointed at a chart if it has none yet (a chart an admin
// assigned by hand is never replaced).
import { PrismaClient } from '@prisma/client';
import { SIZE_CHARTS } from './size-chart-data.mjs';

const prisma = new PrismaClient();

async function main() {
  for (const c of SIZE_CHARTS) {
    const data = {
      name: c.name,
      basis: c.basis,
      garmentFlat: c.garmentFlat,
      fit: c.fit,
      stretch: c.stretch,
      notes: c.notes,
      source: c.source,
      verified: c.verified,
      sizes: c.sizes,
      ease: c.ease,
    };
    const existing = await prisma.sizeChart.findFirst({ where: { name: c.name } });
    const chart = existing
      ? await prisma.sizeChart.update({ where: { id: existing.id }, data })
      : await prisma.sizeChart.create({ data });
    console.log(`${existing ? 'Updated' : 'Created'} size chart "${chart.name}".`);

    for (const slug of c.categorySlugs) {
      const category = await prisma.category.findUnique({ where: { slug } });
      if (!category) {
        console.log(`  Category "${slug}" not found — skipped.`);
      } else if (category.sizeChartId && category.sizeChartId !== chart.id) {
        console.log(`  Category "${slug}" already uses another size chart — left unchanged.`);
      } else {
        await prisma.category.update({ where: { id: category.id }, data: { sizeChartId: chart.id } });
        console.log(`  Category "${slug}" now uses this chart.`);
      }
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
