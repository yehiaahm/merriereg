/**
 * Better Stack observability — server side (Node.js runtime only).
 *
 * Loaded once from `register()` in instrumentation.ts. Everything here is
 * opt-in through environment variables, so local dev and any environment
 * without them configured behaves exactly as before:
 *
 *   BETTER_STACK_SOURCE_TOKEN      Telemetry → Sources → "MERRIER backend" → Source token
 *   BETTER_STACK_INGESTING_HOST    same page → Ingesting host (e.g. sXXXX.us-west-2a.betterstackdata.com)
 *   BETTER_STACK_ERRORS_DSN        Error tracking → Applications → "MERRIER website" → DSN
 *
 * What it does:
 *   1. Logs   — forwards every server console.debug/log/info/warn/error to
 *               Better Stack (Live tail), while still printing to stdout so
 *               Railway's own log viewer keeps working.
 *   2. Errors — reports server exceptions (from Next's onRequestError hook)
 *               to Better Stack Error tracking via its Sentry-compatible DSN.
 *
 * Never import this from client components or the Edge runtime.
 */
import { Logtail } from '@logtail/node';
import * as Sentry from '@sentry/node';

type RequestErrorRequest = {
  path: string;
  method: string;
  headers: Record<string, string | string[] | undefined>;
};

type RequestErrorContext = {
  routerKind: string;
  routePath: string;
  routeType: string;
  renderSource?: string;
  revalidateReason?: string;
};

const environment = process.env.NODE_ENV === 'production' ? 'production' : 'development';
const release = process.env.RAILWAY_GIT_COMMIT_SHA || undefined;

let logtail: Logtail | null = null;
let errorsEnabled = false;
let initialized = false;

function normalizeHost(host: string): string {
  const trimmed = host.trim().replace(/\/+$/, '');
  return /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function initLogs() {
  const token = process.env.BETTER_STACK_SOURCE_TOKEN;
  const host = process.env.BETTER_STACK_INGESTING_HOST;
  if (!token || !host) return;

  logtail = new Logtail(token, {
    endpoint: normalizeHost(host),
    // A failed log shipment must never crash or slow down a customer request.
    ignoreExceptions: true,
    // Protects the free plan quota (3 GB/month) from a runaway log loop.
    burstProtectionMilliseconds: 5000,
    burstProtectionMax: 500,
  });

  // Mirror all existing console.* calls (there are many across the app's API
  // routes) to Better Stack without touching each call site. Output still
  // reaches stdout, so Railway's log viewer is unaffected.
  logtail.replaceConsoleMethods();
}

function initErrors() {
  const dsn = process.env.BETTER_STACK_ERRORS_DSN;
  if (!dsn) return;

  // Minimal Sentry client: Better Stack Error tracking speaks the Sentry
  // protocol. OpenTelemetry auto-instrumentation and performance tracing are
  // deliberately off — the app already runs its own OTel log pipeline for
  // PostHog, and we only want exception reports here.
  Sentry.initWithoutDefaultIntegrations({
    dsn,
    environment,
    release,
    enableOpenTelemetrySetup: false,
    tracesSampleRate: 0,
    // No sendDefaultPii in SDK v11: request bodies/cookies/IPs aren't attached
    // by default, and request headers are redacted in reportRequestError().
    integrations: [
      Sentry.linkedErrorsIntegration(),
      Sentry.contextLinesIntegration(),
      Sentry.onUncaughtExceptionIntegration(),
      Sentry.onUnhandledRejectionIntegration({ mode: 'warn' }),
    ],
  });
  errorsEnabled = true;
}

export function initBetterStack() {
  if (initialized) return;
  initialized = true;

  try {
    initLogs();
    initErrors();
  } catch (err) {
    // Observability must never take the store down.
    console.warn('Better Stack initialisation failed — continuing without it', err);
    return;
  }

  if (logtail || errorsEnabled) {
    const flush = () => {
      void flushBetterStack();
    };
    process.once('SIGTERM', flush);
    process.once('beforeExit', flush);
  }
}

/** Headers that must never leave the server (session cookies, auth). */
const REDACTED_HEADERS = new Set(['cookie', 'authorization', 'set-cookie', 'x-api-key']);

function safeHeaders(headers: RequestErrorRequest['headers']) {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    out[key] = REDACTED_HEADERS.has(key.toLowerCase())
      ? '[redacted]'
      : Array.isArray(value)
        ? value.join(', ')
        : value;
  }
  return out;
}

export async function reportRequestError(
  error: unknown,
  request: RequestErrorRequest,
  context: RequestErrorContext,
) {
  const err = error instanceof Error ? error : new Error(String(error));
  const digest = (error as { digest?: string } | null)?.digest;
  const details = {
    path: request.path,
    method: request.method,
    routePath: context.routePath,
    routeType: context.routeType,
    routerKind: context.routerKind,
    renderSource: context.renderSource,
    digest,
  };

  if (logtail) {
    // Logged directly (not via console) so it carries structured fields.
    void logtail.error(`Request error: ${request.method} ${request.path} — ${err.message}`, {
      ...details,
      error: { name: err.name, message: err.message, stack: err.stack },
    });
  }

  if (errorsEnabled) {
    Sentry.withScope((scope) => {
      scope.setTags({
        route: context.routePath,
        route_type: context.routeType,
        method: request.method,
      });
      scope.setContext('request', { ...details, headers: safeHeaders(request.headers) });
      Sentry.captureException(err);
    });
  }
}

export async function flushBetterStack(): Promise<void> {
  await Promise.allSettled([
    logtail?.flush(),
    errorsEnabled ? Sentry.flush(2000) : undefined,
  ]);
}
