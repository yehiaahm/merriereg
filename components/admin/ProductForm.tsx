'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type VariantForm = {
  id?: string;
  size: string;
  color: string;
  colorHex: string;
  sku: string;
  priceEGP: string;
  compareAtPriceEGP: string;
  stock: string;
  active: boolean;
};

type ImageForm = { url: string; altText: string; colorValue: string };

type CategoryOption = { id: string; name: string };

type ProductFormValue = {
  id?: string;
  name: string;
  slug: string;
  description: string;
  status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED' | 'POS_ONLY';
  categoryId?: string | null;
  images: ImageForm[];
  variants: VariantForm[];
};

const emptyVariant: VariantForm = {
  size: '',
  color: '',
  colorHex: '',
  sku: '',
  priceEGP: '',
  compareAtPriceEGP: '',
  stock: '0',
  active: true,
};

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

export function ProductForm({
  initial,
  categories = [],
}: {
  initial?: ProductFormValue;
  categories?: CategoryOption[];
}) {
  const router = useRouter();
  const isEdit = Boolean(initial?.id);

  const [name, setName] = useState(initial?.name ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [description, setDescription] = useState(initial?.description ?? '');
  const [status, setStatus] = useState<ProductFormValue['status']>(initial?.status ?? 'DRAFT');
  const [categoryId, setCategoryId] = useState<string>(initial?.categoryId ?? '');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [images, setImages] = useState<ImageForm[]>(initial?.images ?? [{ url: '', altText: '', colorValue: '' }]);
  const [variants, setVariants] = useState<VariantForm[]>(initial?.variants ?? [{ ...emptyVariant }]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleNameChange(value: string) {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  function updateVariant(index: number, patch: Partial<VariantForm>) {
    setVariants((prev) => prev.map((v, i) => (i === index ? { ...v, ...patch } : v)));
  }

  function updateImage(index: number, patch: Partial<ImageForm>) {
    setImages((prev) => prev.map((img, i) => (i === index ? { ...img, ...patch } : img)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (variants.length === 0) {
      setError('Add at least one variant.');
      return;
    }

    const payload = {
      name,
      slug,
      description,
      status,
      categoryId: isCreatingCategory ? undefined : categoryId || null,
      newCategoryName: isCreatingCategory && newCategoryName.trim() ? newCategoryName.trim() : undefined,
      images: images.filter((img) => img.url.trim()).map((img) => ({ url: img.url.trim(), altText: img.altText, colorValue: img.colorValue || undefined })),
      variants: variants.map((v) => ({
        id: v.id,
        size: v.size,
        color: v.color,
        colorHex: v.colorHex || undefined,
        sku: v.sku,
        priceEGP: Number(v.priceEGP),
        compareAtPriceEGP: v.compareAtPriceEGP ? Number(v.compareAtPriceEGP) : undefined,
        stock: Number(v.stock),
        active: v.active,
      })),
    };

    setSubmitting(true);
    const url = isEdit ? `/api/admin/products/${initial!.id}` : '/api/admin/products';
    const res = await fetch(url, {
      method: isEdit ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error ?? 'Could not save product.');
      return;
    }

    router.push('/admin/products');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 820 }}>
      {error && (
        <div style={{ background: '#fdecea', border: '1px solid var(--danger)', padding: 12, fontSize: 14 }}>
          {error}
        </div>
      )}

      <fieldset style={{ border: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <legend style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Product Info</legend>
        <div className="field">
          <label htmlFor="name">Name</label>
          <input id="name" value={name} onChange={(e) => handleNameChange(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="slug">Slug</label>
          <input
            id="slug"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="description">Description</label>
          <textarea id="description" rows={5} value={description} onChange={(e) => setDescription(e.target.value)} required />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="field">
            <label htmlFor="status">Status</label>
            <select id="status" value={status} onChange={(e) => setStatus(e.target.value as ProductFormValue['status'])}>
              <option value="DRAFT">Draft (hidden)</option>
              <option value="ACTIVE">Active (visible in store)</option>
              <option value="POS_ONLY">POS Only (sellable in-store, hidden from website)</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>
          <div className="field">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label htmlFor="category">Category</label>
              <button
                type="button"
                onClick={() => setIsCreatingCategory(!isCreatingCategory)}
                style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
              >
                {isCreatingCategory ? 'Choose existing' : '+ New Category'}
              </button>
            </div>
            {isCreatingCategory ? (
              <input
                placeholder="e.g. Hoodies, T-Shirts, Outerwear"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
              />
            ) : (
              <select
                id="category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">No Category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </fieldset>

      <fieldset style={{ border: 'none', padding: 0 }}>
        <legend style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Images</legend>
        <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 10 }}>
          Paste image URLs (host them anywhere — e.g. an image CDN). Optionally tag an image with a color so it
          swaps automatically when that color is selected.
        </p>
        {images.map((img, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8, marginBottom: 8 }}>
            <input placeholder="https://…" value={img.url} onChange={(e) => updateImage(i, { url: e.target.value })} />
            <input placeholder="Alt text" value={img.altText} onChange={(e) => updateImage(i, { altText: e.target.value })} />
            <input placeholder="Color (optional)" value={img.colorValue} onChange={(e) => updateImage(i, { colorValue: e.target.value })} />
            <button
              type="button"
              className="btn btn-outline"
              style={{ minHeight: 40, padding: '0 12px' }}
              onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn btn-outline"
          style={{ marginTop: 4 }}
          onClick={() => setImages((prev) => [...prev, { url: '', altText: '', colorValue: '' }])}
        >
          + Add Image
        </button>
      </fieldset>

      <fieldset style={{ border: 'none', padding: 0 }}>
        <legend style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Variants</legend>
        {variants.map((v, i) => (
          <div
            key={v.id ?? `new-${i}`}
            style={{ border: '1px solid var(--line)', padding: 14, marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 8 }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <input placeholder="Size (e.g. M)" value={v.size} onChange={(e) => updateVariant(i, { size: e.target.value })} required />
              <input placeholder="Color (e.g. Black)" value={v.color} onChange={(e) => updateVariant(i, { color: e.target.value })} required />
              <input placeholder="Color hex (#000000)" value={v.colorHex} onChange={(e) => updateVariant(i, { colorHex: e.target.value })} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
              <input placeholder="SKU" value={v.sku} onChange={(e) => updateVariant(i, { sku: e.target.value })} required />
              <input placeholder="Price (EGP)" type="number" min="0" step="0.01" value={v.priceEGP} onChange={(e) => updateVariant(i, { priceEGP: e.target.value })} required />
              <input placeholder="Compare-at (EGP)" type="number" min="0" step="0.01" value={v.compareAtPriceEGP} onChange={(e) => updateVariant(i, { compareAtPriceEGP: e.target.value })} />
              <input placeholder="Stock" type="number" min="0" value={v.stock} onChange={(e) => updateVariant(i, { stock: e.target.value })} required />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                <input type="checkbox" checked={v.active} onChange={(e) => updateVariant(i, { active: e.target.checked })} />
                Active
              </label>
              <button
                type="button"
                className="btn btn-danger"
                style={{ minHeight: 36, padding: '0 12px' }}
                onClick={() => setVariants((prev) => prev.filter((_, idx) => idx !== i))}
                disabled={variants.length === 1}
              >
                Remove Variant
              </button>
            </div>
          </div>
        ))}
        <button type="button" className="btn btn-outline" onClick={() => setVariants((prev) => [...prev, { ...emptyVariant }])}>
          + Add Variant
        </button>
      </fieldset>

      <div>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Product'}
        </button>
      </div>
    </form>
  );
}
