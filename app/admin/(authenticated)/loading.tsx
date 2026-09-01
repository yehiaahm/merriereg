export default function AdminLoading() {
  return (
    <div>
      <div className="skeleton" style={{ width: 180, height: 28, marginBottom: 24 }} />
      <div className="admin-kpi-grid">
        <div className="skeleton" style={{ height: 108 }} />
        <div className="skeleton" style={{ height: 108 }} />
        <div className="skeleton" style={{ height: 108 }} />
      </div>
      <div className="skeleton" style={{ width: '100%', height: 240 }} />
    </div>
  );
}
