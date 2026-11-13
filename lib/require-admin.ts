import { redirect } from 'next/navigation';
import { getCurrentCustomer } from '@/lib/customer-auth';

/**
 * Server-side admin check for admin PAGES. proxy.ts only verifies the signed
 * `admin` claim inside the cookie (stateless, valid for up to 12 h); this
 * re-reads isAdmin from the database so a demoted or deleted admin loses access
 * immediately. Call it at the top of every admin page — it must run per page,
 * not only in the layout, because layouts are not re-rendered on soft navigation.
 */
export async function requireAdmin(nextPath = '/admin') {
  const admin = await getCurrentCustomer();
  if (!admin?.isAdmin) {
    redirect(`/account/login?next=${encodeURIComponent(nextPath)}`);
  }
  return admin;
}
