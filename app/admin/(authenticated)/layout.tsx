import { getCurrentCustomer } from '@/lib/customer-auth';
import { AdminShell } from '@/components/admin/AdminShell';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getCurrentCustomer();
  return <AdminShell adminName={admin?.name}>{children}</AdminShell>;
}
