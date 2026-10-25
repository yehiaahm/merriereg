import { NextResponse } from 'next/server';
import { getCurrentCustomer } from '@/lib/customer-auth';
import { getVapidConfig } from '@/lib/push/config';

export const dynamic = 'force-dynamic';

// Protected by proxy.ts's `/api/admin/:path*` matcher; the explicit check
// below is defense in depth (same pattern as the POS route).
export async function GET() {
  const admin = await getCurrentCustomer();
  if (!admin?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cfg = getVapidConfig();
  // Only the PUBLIC key is ever sent to the browser; the private key stays in
  // the server environment.
  return NextResponse.json({ configured: cfg !== null, publicKey: cfg?.publicKey ?? null });
}
