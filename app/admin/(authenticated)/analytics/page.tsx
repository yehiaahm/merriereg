import { AnalyticsDashboard } from '@/components/admin/AnalyticsDashboard';

export const metadata = { title: 'Admin — Analytics' };

export default function AdminAnalyticsPage() {
  return (
    <div>
      <div className="admin-page-head">
        <h1>Analytics</h1>
      </div>
      <AnalyticsDashboard />
    </div>
  );
}
