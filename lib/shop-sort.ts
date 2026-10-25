export const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
] as const;

export type SortValue = (typeof SORT_OPTIONS)[number]['value'];

export function parseSort(value: string | undefined): SortValue {
  return SORT_OPTIONS.some((o) => o.value === value) ? (value as SortValue) : 'newest';
}
