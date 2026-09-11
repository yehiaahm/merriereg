// Mirrors lib/orders.ts's ORDER_STATUS_STEPS — kept as a plain literal here
// (not imported) because that module pulls in Prisma and other server-only
// code that can't be bundled into pages that render this client-side.
const STATUS_STEPS = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'] as const;

export function OrderStatusTimeline({ status }: { status: string }) {
  if (status === 'CANCELLED') {
    return (
      <p className="badge badge-status" style={{ marginBottom: 24 }}>
        CANCELLED
      </p>
    );
  }

  const currentStepIndex = STATUS_STEPS.indexOf(status as (typeof STATUS_STEPS)[number]);

  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 32 }}>
      {STATUS_STEPS.map((step, i) => (
        <div key={step} style={{ flex: 1 }}>
          <div
            style={{
              height: 4,
              background: i <= currentStepIndex ? 'var(--accent)' : 'var(--line)',
              marginBottom: 6,
            }}
          />
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink-soft)' }}>
            {step}
          </div>
        </div>
      ))}
    </div>
  );
}
