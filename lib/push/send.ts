import webpush from 'web-push';
import { prisma } from '@/lib/prisma';
import { ensureVapidConfigured } from '@/lib/push/config';

export interface PushPayload {
  title: string;
  body: string;
  /** Same-origin path the notification opens when tapped. Never grants access by itself. */
  url: string;
  /** Notifications with the same tag replace each other on a device. */
  tag: string;
}

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface SenderResult {
  statusCode: number;
}

/** Sends one encrypted message. Must reject with an object carrying `statusCode` on HTTP failures. */
export type PushSender = (target: PushTarget, body: string) => Promise<SenderResult>;

export const defaultSender: PushSender = async (target, body) => {
  ensureVapidConfigured();
  const res = await webpush.sendNotification(
    { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
    body,
    {
      TTL: 60 * 60 * 24, // hold up to a day for a phone that is offline
      urgency: 'high', // deliver immediately, even in Doze / low-power mode
      timeout: 10_000,
    }
  );
  return { statusCode: res.statusCode };
};

export type DeliveryOutcome = 'sent' | 'gone' | 'failed';

export interface DeliveryResult {
  outcome: DeliveryOutcome;
  statusCode?: number;
  attempts: number;
  /** True when a later retry could plausibly succeed (network error, 429, 5xx). */
  transient: boolean;
}

const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [500, 1500];

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function statusOf(err: unknown): number | undefined {
  const code = (err as { statusCode?: unknown } | null)?.statusCode;
  return typeof code === 'number' ? code : undefined;
}

/** Delivers to one subscription with bounded retries on transient failures. */
export async function deliverToTarget(
  target: PushTarget,
  payload: PushPayload,
  sender: PushSender = defaultSender,
  backoffMs: number[] = BACKOFF_MS
): Promise<DeliveryResult> {
  const body = JSON.stringify(payload);
  let lastStatus: number | undefined;
  let transient = false;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await sender(target, body);
      if (res.statusCode >= 200 && res.statusCode < 300) {
        return { outcome: 'sent', statusCode: res.statusCode, attempts: attempt, transient: false };
      }
      lastStatus = res.statusCode;
      transient = res.statusCode === 429 || res.statusCode >= 500;
    } catch (err) {
      lastStatus = statusOf(err);
      // 404/410: the push service says this subscription no longer exists.
      if (lastStatus === 404 || lastStatus === 410) {
        return { outcome: 'gone', statusCode: lastStatus, attempts: attempt, transient: false };
      }
      // No status = network error / timeout; 429 and 5xx = push service trouble.
      transient = lastStatus === undefined || lastStatus === 429 || lastStatus >= 500;
    }

    if (!transient || attempt === MAX_ATTEMPTS) return { outcome: 'failed', statusCode: lastStatus, attempts: attempt, transient };
    await sleep(backoffMs[attempt - 1] ?? 1500);
  }

  return { outcome: 'failed', statusCode: lastStatus, attempts: MAX_ATTEMPTS, transient };
}

export interface BatchSummary {
  total: number;
  sent: number;
  gone: number;
  failed: number;
  /** Failures worth retrying later (as opposed to permanent rejections). */
  transientFailures: number;
}

/** A subscription that keeps failing for non-"gone" reasons is dropped after this many consecutive failures. */
const MAX_CONSECUTIVE_FAILURES = 10;

function hostOf(endpoint: string): string {
  try {
    return new URL(endpoint).host;
  } catch {
    return 'invalid-endpoint';
  }
}

/**
 * Delivers a payload to every subscription belonging to a CURRENT admin
 * (Customer.isAdmin re-checked here, so a demoted admin stops receiving
 * notifications immediately even if their devices are still registered).
 * Pass `customerId` to restrict to one admin's devices (used by the test button).
 *
 * Never throws for delivery problems; database/config errors propagate to the
 * caller, which is itself a fire-and-forget background task.
 */
export async function deliverToAdmins(
  payload: PushPayload,
  opts: { customerId?: string; sender?: PushSender; backoffMs?: number[] } = {}
): Promise<BatchSummary> {
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { customer: { isAdmin: true }, ...(opts.customerId ? { customerId: opts.customerId } : {}) },
  });

  const results = await Promise.all(
    subscriptions.map(async (sub) => ({
      sub,
      result: await deliverToTarget(sub, payload, opts.sender, opts.backoffMs),
    }))
  );

  const summary: BatchSummary = { total: results.length, sent: 0, gone: 0, failed: 0, transientFailures: 0 };

  for (const { sub, result } of results) {
    const where = `subscription ${sub.id} (${hostOf(sub.endpoint)})`;
    if (result.outcome === 'sent') {
      summary.sent++;
      await prisma.pushSubscription
        .update({ where: { id: sub.id }, data: { lastUsedAt: new Date(), failureCount: 0 } })
        .catch(() => undefined);
    } else if (result.outcome === 'gone') {
      summary.gone++;
      console.info(`[push] ${where} expired (HTTP ${result.statusCode}) — removed`);
      await prisma.pushSubscription.deleteMany({ where: { id: sub.id } });
    } else {
      summary.failed++;
      if (result.transient) summary.transientFailures++;
      console.error(
        `[push] delivery to ${where} failed after ${result.attempts} attempt(s): HTTP ${result.statusCode ?? 'network error'}` +
          (result.statusCode === 401 || result.statusCode === 403 ? ' — check the VAPID keys/subject' : '')
      );
      const updated = await prisma.pushSubscription
        .update({ where: { id: sub.id }, data: { failureCount: { increment: 1 } } })
        .catch(() => null);
      if (updated && updated.failureCount >= MAX_CONSECUTIVE_FAILURES) {
        console.warn(`[push] ${where} failed ${updated.failureCount} times in a row — removed`);
        await prisma.pushSubscription.deleteMany({ where: { id: sub.id } });
      }
    }
  }

  return summary;
}
