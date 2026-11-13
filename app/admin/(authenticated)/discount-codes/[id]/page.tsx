import { requireAdmin } from '@/lib/require-admin';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { DiscountCodeForm, type DiscountCodeFormValue } from '@/components/admin/DiscountCodeForm';

export const metadata = { title: 'Admin — Edit Discount Code' };
export const dynamic = 'force-dynamic';

const egp = (piastres: number | null) => (piastres === null ? '' : String(piastres / 100));

export default async function EditDiscountCodePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const c = await prisma.discountCode.findUnique({ where: { id } });
  if (!c) notFound();

  const initial: DiscountCodeFormValue = {
    id: c.id,
    code: c.code,
    label: c.label ?? '',
    type: c.type,
    value: c.type === 'PERCENT' ? String(c.value) : egp(c.value),
    maxDiscount: egp(c.maxDiscount),
    minSubtotal: c.minSubtotal > 0 ? egp(c.minSubtotal) : '',
    usageLimit: c.usageLimit === null ? '' : String(c.usageLimit),
    oncePerCustomer: c.oncePerCustomer,
    // ISO here; the form converts to the admin's local time after mount.
    startsAt: c.startsAt?.toISOString() ?? '',
    expiresAt: c.expiresAt?.toISOString() ?? '',
    active: c.active,
    showInBar: c.showInBar,
    showAtCheckout: c.showAtCheckout,
    barText: c.barText ?? '',
    usedCount: c.usedCount,
  };

  return (
    <div>
      <h1 style={{ fontSize: 28, marginBottom: 24 }}>Edit Discount Code</h1>
      <DiscountCodeForm initial={initial} />
    </div>
  );
}
