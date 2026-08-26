import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomerSessionToken, CUSTOMER_COOKIE_NAME } from '@/lib/customer-session-token';

/**
 * Backend authorization for every /admin page and /api/admin endpoint.
 * This is the real gate — the admin UI hiding links is only a convenience,
 * never the security boundary (per "never rely only on frontend route
 * protection"). There is no separate admin login: an admin is just a
 * Customer row with isAdmin: true, signed in the same way as everyone else
 * via /account/login — this only checks the `admin` claim already signed
 * into their session token.
 */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isAdminApi = pathname.startsWith('/api/admin');
  const isAdminPage = pathname.startsWith('/admin');

  if (!isAdminApi && !isAdminPage) {
    return NextResponse.next();
  }

  const token = req.cookies.get(CUSTOMER_COOKIE_NAME)?.value;
  const claims = await verifyCustomerSessionToken(token);

  if (claims?.isAdmin) {
    return NextResponse.next();
  }

  if (isAdminApi) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const loginUrl = new URL('/account/login', req.url);
  loginUrl.searchParams.set('next', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
