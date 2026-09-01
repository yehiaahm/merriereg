import Link from 'next/link';
import { EmptyState } from './EmptyState';
import type { ActivityEvent } from '@/lib/analytics/activity';

function timeAgo(date: Date): string {
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString('en-EG', { month: 'short', day: 'numeric' });
}

export function RecentActivity({ events }: { events: ActivityEvent[] }) {
  if (events.length === 0) {
    return <EmptyState title="No recent activity" />;
  }

  return (
    <ul className="admin-activity-list">
      {events.map((e) => (
        <li key={e.id} className="admin-activity-item" data-kind={e.kind}>
          <span className="admin-activity-dot" />
          <div style={{ flex: 1, minWidth: 0 }}>
            {e.href ? (
              <Link href={e.href} style={{ color: 'var(--ink)' }}>
                {e.message}
              </Link>
            ) : (
              <span>{e.message}</span>
            )}
            <div className="admin-activity-time">{timeAgo(e.at)}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}
