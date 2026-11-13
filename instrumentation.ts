import { SeverityNumber } from '@opentelemetry/api-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { BatchLogRecordProcessor, LoggerProvider } from '@opentelemetry/sdk-logs';

const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

function warnForMissingConfiguration() {
  if (process.env.NODE_ENV === 'production') return;

  const missingVariable = projectToken ? 'NEXT_PUBLIC_POSTHOG_HOST' : 'NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN';
  console.warn(
    `${missingVariable} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${missingVariable} is configured`
  );
}

export const posthogLoggerProvider =
  projectToken && host
    ? new LoggerProvider({
        resource: resourceFromAttributes({ 'service.name': 'merrier' }),
        processors: [
          new BatchLogRecordProcessor({
            exporter: new OTLPLogExporter({
              url: `${host.replace(/\/$/, '')}/i/v1/logs`,
              headers: {
                Authorization: `Bearer ${projectToken}`,
                'Content-Type': 'application/json',
              },
            }),
          }),
        ],
      })
    : null;

if (!posthogLoggerProvider) warnForMissingConfiguration();

// This logger is intentionally separate from the app's existing console logs.
// Only log records added by this integration are exported to PostHog.
export const posthogLogger = posthogLoggerProvider?.getLogger('merrier.posthog');

export { SeverityNumber };

export async function flushPostHogLogs(): Promise<void> {
  await posthogLoggerProvider?.forceFlush().catch(() => undefined);
}

// Better Stack (logs + error tracking). Node.js runtime only — the module uses
// Node APIs, so it's imported dynamically and never bundled for the Edge
// runtime (proxy.ts). See lib/observability/betterstack-server.ts.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initBetterStack } = await import('./lib/observability/betterstack-server');
    initBetterStack();
  }
}

type OnRequestError = (
  error: unknown,
  request: {
    path: string;
    method: string;
    headers: Record<string, string | string[] | undefined>;
  },
  context: {
    routerKind: string;
    routePath: string;
    routeType: string;
    renderSource?: string;
    revalidateReason?: string;
  },
) => Promise<void>;

// Called by Next.js for every uncaught error thrown while rendering a page or
// handling a route/server action — reports it to Better Stack.
export const onRequestError: OnRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  try {
    const { reportRequestError } = await import('./lib/observability/betterstack-server');
    await reportRequestError(error, request, context);
  } catch {
    // Reporting must never mask the original error.
  }
};
