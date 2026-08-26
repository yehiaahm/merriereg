import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { customerSignupSchema } from '@/lib/validation';
import { hashPassword, setCustomerSessionCookie, linkGuestOrders } from '@/lib/customer-auth';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  // 5 new accounts per hour per IP — slows down mass account creation
  // without getting in the way of a real household signing up together.
  if (!rateLimit(req, 'signup', 5, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = customerSignupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 });
  }
  const { name, email, password, phone } = parsed.data;

  const existing = await prisma.customer.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
  }

  let customer;
  try {
    customer = await prisma.customer.create({
      data: { name, email, phone: phone ?? null, passwordHash: hashPassword(password) },
    });
  } catch (err) {
    // Two signups for the same email landing in the same instant both pass
    // the findUnique check above — the DB's unique constraint is the real
    // guard, so translate its violation into the same clean 409 instead of
    // letting a raw 500 through.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
    }
    throw err;
  }

  await linkGuestOrders(customer.id, email, phone);
  // New accounts are never admin (isAdmin defaults false) — promotion only
  // happens via the make-admin script, never through the web.
  await setCustomerSessionCookie(customer.id, false);

  return NextResponse.json({ ok: true });
}
