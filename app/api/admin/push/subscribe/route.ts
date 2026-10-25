import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getCurrentCustomer } from '@/lib/customer-auth';
import { isAllowedPushEndpoint } from '@/lib/push/config';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const MAX_DEVICES_PER_ADMIN = 10;

const subscribeSchema = z.object({
  endpoint: z
    .string()
    .url()
    .max(2048)
    .refine(isAllowedPushEndpoint, 'Unsupported push service.'),
  keys: z.object({
    p256dh: z.string().min(20).max(256),
    auth: z.string().min(8).max(64),
  }),
});

// Registers (or refreshes) the calling admin's device. Idempotent: the same
// browser re-posting its subscription just updates the existing row.
export async function POST(req: NextRequest) {
  const admin = await getCurrentCustomer();
  if (!admin?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!rateLimit(req, 'push-subscribe', 30, 10 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = subscribeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid push subscription.' }, { status: 400 });
  }
  const { endpoint, keys } = parsed.data;
  const userAgent = (req.headers.get('user-agent') ?? '').slice(0, 300) || null;

  // The endpoint is unique per browser install. If it already belongs to
  // another account (e.g. a shared device), it moves to the account that is
  // signed in now — the one who just proved control of it.
  const subscription = await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { customerId: admin.id, p256dh: keys.p256dh, auth: keys.auth, userAgent, failureCount: 0 },
    create: { customerId: admin.id, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent },
  });

  // Cap devices per admin: drop the oldest beyond the limit.
  const mine = await prisma.pushSubscription.findMany({
    where: { customerId: admin.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  if (mine.length > MAX_DEVICES_PER_ADMIN) {
    await prisma.pushSubscription.deleteMany({
      where: { id: { in: mine.slice(MAX_DEVICES_PER_ADMIN).map((s) => s.id) } },
    });
  }

  return NextResponse.json({ ok: true, id: subscription.id }, { status: 201 });
}
