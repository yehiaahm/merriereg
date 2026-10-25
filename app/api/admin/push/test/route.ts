import { NextRequest, NextResponse } from 'next/server';
import { getCurrentCustomer } from '@/lib/customer-auth';
import { isPushConfigured } from '@/lib/push/config';
import { deliverToAdmins } from '@/lib/push/send';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

// Sends a test notification to the CALLING admin's own devices only.
export async function POST(req: NextRequest) {
  const admin = await getCurrentCustomer();
  if (!admin?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isPushConfigured()) {
    return NextResponse.json(
      { error: 'Push notifications are not configured on the server (VAPID keys missing).' },
      { status: 503 }
    );
  }
  if (!rateLimit(req, 'push-test', 10, 10 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many test notifications. Please wait a few minutes.' }, { status: 429 });
  }

  try {
    const summary = await deliverToAdmins(
      {
        title: 'MERRIER test notification',
        body: 'Order notifications are working on this device.',
        url: '/admin/notifications',
        tag: `test-${Date.now()}`,
      },
      { customerId: admin.id }
    );

    if (summary.total === 0) {
      return NextResponse.json({ error: 'No devices are registered yet. Enable notifications first.' }, { status: 409 });
    }
    if (summary.sent === 0) {
      return NextResponse.json(
        { error: 'The push service did not accept the notification. Try disabling and re-enabling notifications.', ...summary },
        { status: 502 }
      );
    }
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    console.error('[push] test notification failed', err);
    return NextResponse.json({ error: 'Could not send the test notification.' }, { status: 500 });
  }
}
