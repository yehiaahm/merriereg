import { redirect } from 'next/navigation';
import { createHash } from 'crypto';
import { prisma } from '@/lib/prisma';
import { getCurrentCustomer } from '@/lib/customer-auth';
import { isPushConfigured } from '@/lib/push/config';
import { PushNotificationSettings, type DeviceRow } from '@/components/admin/PushNotificationSettings';

export const metadata = { title: 'Admin — Order Notifications' };
export const dynamic = 'force-dynamic';

function describeDevice(userAgent: string | null): string {
  const ua = userAgent ?? '';
  const os = /iPhone/.test(ua)
    ? 'iPhone'
    : /iPad/.test(ua)
      ? 'iPad'
      : /Android/.test(ua)
        ? 'Android'
        : /Windows/.test(ua)
          ? 'Windows'
          : /Mac OS X|Macintosh/.test(ua)
            ? 'Mac'
            : /Linux/.test(ua)
              ? 'Linux'
              : 'Unknown device';
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /SamsungBrowser/.test(ua)
      ? 'Samsung Internet'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Chrome\/|CriOS/.test(ua)
          ? 'Chrome'
          : /Safari\//.test(ua)
            ? 'Safari'
            : 'browser';
  return `${os} · ${browser}`;
}

export default async function AdminNotificationsPage() {
  const admin = await getCurrentCustomer();
  if (!admin?.isAdmin) redirect('/account/login?next=/admin/notifications');

  const subs = await prisma.pushSubscription.findMany({
    where: { customerId: admin.id },
    orderBy: { createdAt: 'desc' },
  });

  const devices: DeviceRow[] = subs.map((s) => ({
    id: s.id,
    label: describeDevice(s.userAgent),
    // The raw endpoint is a bearer secret for that device, so only a hash
    // goes to the browser — enough for it to recognise its own subscription.
    endpointHash: createHash('sha256').update(s.endpoint).digest('hex'),
    createdAt: s.createdAt.toISOString(),
    lastUsedAt: s.lastUsedAt?.toISOString() ?? null,
  }));

  return <PushNotificationSettings serverConfigured={isPushConfigured()} devices={devices} />;
}
