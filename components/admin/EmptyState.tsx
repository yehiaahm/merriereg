export function EmptyState({ title, message }: { title: string; message?: string }) {
  return (
    <div className="admin-empty-state">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M8 12h8M12 8v8" opacity="0.4" />
      </svg>
      <strong style={{ color: 'var(--ink)', fontSize: 14 }}>{title}</strong>
      {message && <span>{message}</span>}
    </div>
  );
}
