import { NextRequest, NextResponse } from 'next/server';
import { customerLoginSchema } from '@/lib/validation';
import { verifyPassword, setCustomerSessionCookie } from '@/lib/customer-auth';
import { prisma } from '@/lib/prisma';
import { rateLimit, isBlocked, recordFailure, clearFailures } from '@/lib/rate-limit';

const ACCOUNT_FAIL_LIMIT = 8;
const ACCOUNT_FAIL_WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: NextRequest) {
  // 10 attempts per 10 minutes per IP — enough for a genuine typo or two,
  // tight enough to blunt password-guessing from one address.
  if (!rateLimit(req, 'login', 10, 10 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = customerLoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
  }
  const { email, password } = parsed.data;

  // Per-account throttle: stops distributed guessing against one email even
  // when the attacker rotates IP addresses.
  if (isBlocked('login-fail', email, ACCOUNT_FAIL_LIMIT)) {
    return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 });
  }

  const customer = await prisma.customer.findUnique({ where: { email } });
  // verifyPassword runs even for unknown emails so response time does not
  // reveal whether an account exists.
  const ok = verifyPassword(password, customer?.passwordHash ?? DUMMY_HASH);
  if (!customer || !ok) {
    recordFailure('login-fail', email, ACCOUNT_FAIL_WINDOW_MS);
    return NextResponse.json({ error: 'Incorrect email or password.' }, { status: 401 });
  }

  clearFailures('login-fail', email);
  await setCustomerSessionCookie(customer.id, customer.isAdmin);

  return NextResponse.json({ ok: true });
}

// A well-formed scrypt hash of a random value, used only to equalise timing.
const DUMMY_HASH =
  '00112233445566778899aabbccddeeff:' + '0'.repeat(128);
