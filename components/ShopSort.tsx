'use client';

import { useRouter } from 'next/navigation';
import { SORT_OPTIONS, type SortValue } from '@/lib/shop-sort';

export function ShopSort({ sort, category }: { sort: SortValue; category?: string }) {
  const router = useRouter();

  function onChange(next: string) {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (next !== 'newest') params.set('sort', next);
    const qs = params.toString();
    router.replace(qs ? `/products?${qs}` : '/products', { scroll: false });
  }

  return (
    <label className="mr-sort">
      <span>Sort</span>
      <select value={sort} onChange={(e) => onChange(e.target.value)}>
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
