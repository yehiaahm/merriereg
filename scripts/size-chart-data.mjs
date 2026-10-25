// Size charts supplied by the store owner, transcribed from the size-chart
// screenshots they provided ("Height Suggestion" + "Garment Measurements"
// tables, in inches/feet) and converted to the cm the app stores. Kept as
// plain data in its own file so tests/sizing/seed-charts.test.ts can validate
// every chart against the same schema the admin API uses.
//
// Conversions: 1 in = 2.54 cm. Heights are the feet/inches bounds from the
// table (5'2" = 157.5 cm). The table's open-ended rows ("5'2 and under",
// "6'3 +") are bounded by the finder's own input limits (120–230 cm), and the
// gaps the table leaves between rows (e.g. 5'2–5'4) are left as gaps — the
// engine picks the closest size and says it's an estimate.
//
// Garment waist/length/chest are stored for display. The tables give no
// "ease" (how much roomier the garment is than the body), so they are
// deliberately NOT used to pick a size — only the height table is.

const r = (min, max = min) => ({ min, max });

export const SIZE_CHARTS = [
  {
    name: 'Sweats / Sweatpants (height suggestion)',
    // Categories (by slug) this chart becomes the default for, when they
    // don't already have a chart of their own.
    categorySlugs: ['pants'],
    basis: 'GARMENT',
    garmentFlat: false,
    fit: null,
    stretch: null,
    source:
      "Provided by the store owner: size-chart screenshot 'Height Suggestion - Sweats' + garment measurements (inches converted to cm), stated to be MERRIER's sizing.",
    notes: 'Sizing suggestions may vary. Height ranges are a suggestion; garment waist and side length are measured on the garment.',
    verified: true,
    ease: {},
    sizes: [
      { size: 'XS', measurements: { HEIGHT: r(120, 157.5), WAIST: r(68.58), LENGTH: r(88.9) } },
      { size: 'S', measurements: { HEIGHT: r(162.6, 167.6), WAIST: r(71.12), LENGTH: r(96.52) } },
      { size: 'M', measurements: { HEIGHT: r(167.6, 180.3), WAIST: r(76.2), LENGTH: r(104.14) } },
      { size: 'L', measurements: { HEIGHT: r(182.9, 190.5), WAIST: r(83.82), LENGTH: r(110.5) } },
      { size: 'XL', measurements: { HEIGHT: r(190.5, 230), WAIST: r(88.9), LENGTH: r(114.3) } },
    ],
  },
  {
    name: 'Hoodie (height suggestion)',
    // Hoodies and crewnecks live in different categories, so this chart is
    // assigned per product (by slug) instead of per category. The boxy-fit
    // crewnecks share the hoodies' cut. NOT included on purpose: the DEATH and
    // OVERDOSE hoodies (different garment and price point, no chart supplied).
    categorySlugs: [],
    productSlugs: [
      'elegance-in-scilence-regular-shoulder-boxy-fit-hoodie',
      'im-not-even-in-my-prime-yet-boxy-fit-hoodie',
      'ive-been-ghosting-you-cuz-im-working-boxy-fit-hoodie',
      'i-see-my-momma-smile-thats-a-blessin-regular-shoulder-boxy-fit-hoodie',
      'im-not-even-in-my-prime-yet-boxy-fit-crewneck',
      'im-not-even-in-my-prime-yet-boxy-fit-crewneck-v2',
      'ive-been-ghosting-you-cuz-im-working-boxy-fit-crewneck',
    ],
    basis: 'GARMENT',
    // The chest figures (57–69 cm) are half-circumferences, i.e. measured flat.
    garmentFlat: true,
    fit: null,
    stretch: null,
    source:
      "Provided by the store owner: size-chart screenshot 'Height Suggestion - Hoodie' + garment measurements (cm as printed), stated to be MERRIER's sizing.",
    notes: 'Sizing suggestions may vary. Height ranges are a suggestion; chest and length are measured on the garment, laid flat.',
    verified: true,
    ease: {},
    sizes: [
      { size: 'XS', measurements: { HEIGHT: r(120, 157.5), CHEST: r(57.15), LENGTH: r(58.5) } },
      { size: 'S', measurements: { HEIGHT: r(162.6, 167.6), CHEST: r(61), LENGTH: r(62.3) } },
      { size: 'M', measurements: { HEIGHT: r(167.6, 175.3), CHEST: r(62.3), LENGTH: r(64.8) } },
      { size: 'L', measurements: { HEIGHT: r(177.8, 188), CHEST: r(66.04), LENGTH: r(68.58) } },
      { size: 'XL', measurements: { HEIGHT: r(190.5, 230), CHEST: r(69), LENGTH: r(72.4) } },
    ],
  },
];
