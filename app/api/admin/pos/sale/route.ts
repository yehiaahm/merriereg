import { NextRequest, NextResponse } from 'next/server';
import { posSaleSchema } from '@/lib/validation';
import { createPosSale, PosSaleError } from '@/lib/pos';
import { egpToPiastres } from '@/lib/money';
import { getCurrentCustomer } from '@/lib/customer-auth';

// Protected by proxy.ts's `/api/admin/:path*` matcher (isAdmin check) —
// this second check is defense in depth in case that matcher is ever
// narrowed, and also gets us the cashier's identity for the sale record.
export async function POST(req: NextRequest) {
  const admin = await getCurrentCustomer();
  if (!admin?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = posSaleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 });
  }
  const input = parsed.data;

  try {
    const order = await createPosSale({
      items: input.items,
      discountPiastres: input.discountEGP ? egpToPiastres(input.discountEGP) : 0,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerEmail: input.customerEmail,
      paymentMethod: input.paymentMethod,
      cashierId: admin.id,
    });
    return NextResponse.json({ order }, { status: 201 });
  } catch (err) {
    if (err instanceof PosSaleError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error('POS sale failed', err);
    return NextResponse.json({ error: 'Something went wrong completing the sale.' }, { status: 500 });
  }
}
