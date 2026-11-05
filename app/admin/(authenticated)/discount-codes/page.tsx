import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { formatEGP } from '@/lib/money';
import { describeDiscountRule } from '@/lib/promotions';
import { discountCodeStatus, type DiscountCodeStatus } from '@/lib/discount-codes';
import { DiscountCodeRowActions } from '@/components/admin/DiscountCodeRowActions';

export const metadata = { title: 'Admin — Discount Codes' };
export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<DiscountCodeStatus, { text: string; className: string }> = {
  active: { text: 'Active', className: 'badge badge-status' },
  scheduled: { text: 'Scheduled', className: 'badge badge-out' },
  expired: { text: 'Expired', className: 'badge badge-out' },
  used_up: { text: 'Used up', className: 'badge badge-out' },
  disabled: { text: 'Disabled', className: 'badge badge-out' },
};

const formatDate = (d: Date) =>
  new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Cairo' }).format(d);

export default async function AdminDiscountCodesPage() {
  const now = new Date();
  const codes = await prisma.discountCode.findMany({ orderBy: { createdAt: 'desc' } });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 28 }}>Discount Codes</h1>
        <Link href="/admin/discount-codes/new" className="btn btn-primary">
          + Add Discount Code
        </Link>
      </div>
      <p style={{ fontSize: 13, color: 'var(--ink-soft)', maxWidth: 720, marginBottom: 24, lineHeight: 1.6 }}>
        Create codes customers can apply at checkout. Codes ticked <strong>Promo bar</strong> scroll across the top of the
        store while they are valid; <strong>Checkout</strong> codes appear with Copy / Apply buttons. Every code is
        re-checked on the server when the order is placed, so limits and dates can&apos;t be bypassed.
      </p>

      <div className="admin-table-scroll">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Discount</th>
              <th>Status</th>
              <th>Used</th>
              <th>Valid</th>
              <th>Shown in</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {codes.map((c) => {
              const status = STATUS_LABEL[discountCodeStatus(c, now)];
              const shown = [c.showInBar && 'Promo bar', c.showAtCheckout && 'Checkout'].filter(Boolean).join(', ');
              return (
                <tr key={c.id}>
                  <td>
                    <strong>{c.code}</strong>
                    {c.label && <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{c.label}</div>}
                  </td>
                  <td>
                    {describeDiscountRule(c)}
                    {c.type === 'PERCENT' && c.maxDiscount !== null && (
                      <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>up to {formatEGP(c.maxDiscount)}</div>
                    )}
                    {c.minSubtotal > 0 && (
                      <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>min. order {formatEGP(c.minSubtotal)}</div>
                    )}
                  </td>
                  <td>
                    <span className={status.className}>{status.text}</span>
                  </td>
                  <td>
                    {c.usedCount}
                    {c.usageLimit !== null ? ` / ${c.usageLimit}` : ' / ∞'}
                    {c.oncePerCustomer && <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>1 per customer</div>}
                  </td>
                  <td style={{ fontSize: 13 }}>
                    {c.startsAt || c.expiresAt ? (
                      <>
                        {c.startsAt && <div>From {formatDate(c.startsAt)}</div>}
                        {c.expiresAt && <div>Until {formatDate(c.expiresAt)}</div>}
                      </>
                    ) : (
                      <span style={{ color: 'var(--ink-soft)' }}>No dates</span>
                    )}
                  </td>
                  <td style={{ fontSize: 13 }}>{shown || <span style={{ color: 'var(--ink-soft)' }}>Hidden (type-in only)</span>}</td>
                  <td>
                    <DiscountCodeRowActions id={c.id} active={c.active} />
                  </td>
                </tr>
              );
            })}
            {codes.length === 0 && (
              <tr>
                <td colSpan={7} style={{ color: 'var(--ink-soft)' }}>
                  No discount codes yet — add one and customers can use it at checkout.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
