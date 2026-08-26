import { egpToPiastres } from '@/lib/money';

// Shipping rates match the Massar Shipping courier price list (4 zones,
// flat rate per zone). Kept server-side (never trust a shipping cost sent
// from the client) so it can be swapped for live carrier rates later
// without touching checkout logic.
export const SHIPPING_ZONES = [
  {
    id: 'CAIRO_GIZA_NEW_CITIES',
    label: 'Cairo, Giza & New Cities',
    rate: egpToPiastres(70),
    locations: [
      'Cairo',
      'Giza',
      'Madinaty',
      'El Shorouk',
      'Rehab',
      'Mostakbal City',
      'Hadayek October',
      'Sheikh Zayed',
      'Hadayek El Ahram',
      'El Obour',
    ],
  },
  {
    id: 'DELTA_CANAL',
    label: 'Nile Delta & Canal',
    rate: egpToPiastres(90),
    locations: [
      'Alexandria',
      'Sharqia',
      'Gharbia',
      'Mansoura',
      'Dakahlia',
      'Damietta',
      'Kafr El Sheikh',
      'Qalyubia',
      'Monufia',
      'Beheira',
      'Suez',
      'Port Said',
      'Ismailia',
      'Badrashin',
      'Hawamdeya',
      'Shubramant',
    ],
  },
  {
    id: 'UPPER_EGYPT',
    label: 'Upper Egypt (Al Saeed)',
    rate: egpToPiastres(95),
    locations: ['Beni Suef', 'Fayoum', 'Minya', 'Asyut', 'Sohag', 'Qena', 'Luxor', 'Aswan'],
  },
  {
    id: 'REMOTE_BORDER',
    label: 'Remote & Border Areas',
    rate: egpToPiastres(125),
    locations: [
      'Matrouh',
      'North Coast',
      'New Valley',
      'Hurghada',
      'Red Sea',
      'Sharm El Sheikh',
      'South Sinai',
      'North Sinai',
    ],
  },
] as const;

const LOCATION_TO_RATE = new Map<string, number>(
  SHIPPING_ZONES.flatMap((zone) => zone.locations.map((location) => [location, zone.rate] as const))
);

export const GOVERNORATES = SHIPPING_ZONES.flatMap((zone) => zone.locations);

export function calculateShippingCost(location: string): number {
  return LOCATION_TO_RATE.get(location) ?? SHIPPING_ZONES[1].rate;
}
