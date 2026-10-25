import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getCurrentCustomer } from '@/lib/customer-auth';

export const dynamic = 'force-dynamic';

// Either the browser's own endpoint (the "Disable on this device" button) or a
// subscription id (removing an old device from the device list).
const unsubscribeSchema = z
  .object({
    endpoint: z.string().max(2048).optional(),
    id: z.string().max(64).optional(),
  })
  .refine((v) => Boolean(v.endpoint) !== Boolean(v.id), 'Provide exactly one of endpoint or id.');

export async function POST(req: NextRequest) {
  const admin = await getCurrentCustomer();
  if (!admin?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = unsubscribeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  // Scoped to the caller's own account: an admin can only remove their own
  // devices, never another admin's.
  const where = parsed.data.id
    ? { id: parsed.data.id, customerId: admin.id }
    : { endpoint: parsed.data.endpoint!, customerId: admin.id };
  const result = await prisma.pushSubscription.deleteMany({ where });

  return NextResponse.json({ ok: true, removed: result.count });
}
