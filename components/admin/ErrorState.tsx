// Deliberately distinct from EmptyState (per spec: "no data" and "failed to
// load" must never look the same, and a failed fetch must never render as a
// misleading zero).
export function ErrorState({ message = 'Failed to load this data.', onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="admin-error-state">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5M12 16h.01" />
      </svg>
      <strong style={{ fontSize: 14 }}>{message}</strong>
      {onRetry && (
        <button className="btn btn-outline" style={{ marginTop: 10, minHeight: 34, padding: '0 14px' }} onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}
