// Puts the whole winter collection on the website with ONE command, in the
// right order, and switches "Find my size" on:
//
//   1. adds / updates every winter product (each script is idempotent: an
//      already-existing product is skipped, so re-running never duplicates
//      anything or resets stock)
//   2. loads the verified size charts and links them to the products and
//      categories that use them (scripts/seed-size-charts.mjs) — this runs
//      LAST so it also links products that were created in step 1
//
// Usage (from the app folder, e.g. Railway's Console):
//   node scripts/setup-winter-collection.mjs
//
// Each step runs in its own process so one failing step is reported clearly;
// the run continues and exits non-zero at the end if anything failed.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

const STEPS = [
  // Crewnecks
  'add-prime-yet-crewneck.mjs',
  'add-ghosting-crewneck.mjs',
  'add-prime-yet-crewneck-v2.mjs',
  // Hoodies
  'add-elegance-in-scilence-hoodie.mjs',
  'add-prime-yet-hoodie.mjs',
  'add-ghosting-hoodie.mjs',
  'add-momma-smile-hoodie.mjs',
  'add-death-blue-hoodie.mjs',
  'add-overdose-black-hoodie.mjs',
  // Caps
  'add-rare-by-nature-cap.mjs',
  'add-pay-to-live-cap.mjs',
  'add-should-i-quit-my-job-cap.mjs',
  'add-effortlessly-iconic-cap.mjs',
  // Sweatpants (the first two update existing in-store products)
  'launch-black-wide-leg-sweatpants.mjs',
  'launch-dark-grey-wide-leg-sweatpants.mjs',
  'add-brown-super-loose-sweatpants.mjs',
  'add-white-super-loose-sweatpants.mjs',
  // Size charts + links — last
  'seed-size-charts.mjs',
];

const failed = [];
for (const step of STEPS) {
  console.log(`\n=== ${step} ===`);
  const result = spawnSync(process.execPath, [join(here, step)], { stdio: 'inherit' });
  if (result.status !== 0) failed.push(step);
}

console.log('\n----------------------------------------');
if (failed.length > 0) {
  console.log(`${failed.length} step(s) FAILED:\n  - ${failed.join('\n  - ')}`);
  process.exit(1);
}
console.log(`All ${STEPS.length} steps finished. Find my size is on for the hoodies, crewnecks and sweatpants.`);
