import type { Metadata } from 'next';
import { getCurrentCustomer } from '@/lib/customer-auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { AdminPushSync } from '@/components/admin/AdminPushSync';

// The manifest is attached to admin pages only, so the public storefront never
// offers to install as an "admin app". Required for iOS Home Screen web apps,
// which is the only way iPhones can receive web push.
export const metadata: Metadata = {
  manifest: '/admin-manifest',
  icons: { apple: '/push/apple-touch-icon.png' },
  appleWebApp: { capable: true, title: 'MERRIER Admin', statusBarStyle: 'default' },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getCurrentCustomer();
  return (
    <AdminShell adminName={admin?.name}>
      <AdminPushSync />
      {children}
    </AdminShell>
  );
}
