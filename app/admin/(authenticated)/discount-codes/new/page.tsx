import { DiscountCodeForm } from '@/components/admin/DiscountCodeForm';

export const metadata = { title: 'Admin — New Discount Code' };
export const dynamic = 'force-dynamic';

export default function NewDiscountCodePage() {
  return (
    <div>
      <h1 style={{ fontSize: 28, marginBottom: 24 }}>Add Discount Code</h1>
      <DiscountCodeForm />
    </div>
  );
}
