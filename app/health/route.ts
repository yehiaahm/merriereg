import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Health check for Railway (and any uptime monitor). Actually pings the
 * database rather than just returning a static 200, so a real outage (DB
 * unreachable, migrations not applied) is detected instead of masked.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: 'ok' }, { status: 200 });
  } catch (err) {
    console.error('Health check failed', err);
    return NextResponse.json({ status: 'error' }, { status: 503 });
  }
}
