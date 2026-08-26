import { NextRequest, NextResponse } from 'next/server';
import { customerLoginSchema } from '@/lib/validation';
import { verifyPassword, setCustomerSessionCookie, linkGuestOrders } from '@/lib/customer-auth';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  // 10 attempts per 10 minutes per IP — enough for a genuine typo or two,
  // tight enough to blunt password-guessing against a known email.
  if (!rateLimit(req, 'login', 10, 10 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = customerLoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
  }
  const { email, password } = parsed.data;

  const customer = await prisma.customer.findUnique({ where: { email } });
  if (!customer || !verifyPassword(password, customer.passwordHash)) {
    return NextResponse.json({ error: 'Incorrect email or password.' }, { status: 401 });
  }

  await linkGuestOrders(customer.id, customer.email, customer.phone);
  await setCustomerSessionCookie(customer.id, customer.isAdmin);

  return NextResponse.json({ ok: true });
}
