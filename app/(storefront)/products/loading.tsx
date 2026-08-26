export default function LoadingProducts() {
  return (
    <main className="container" style={{ padding: '48px 24px 100px' }}>
      <div className="skeleton" style={{ width: 200, height: 40, marginBottom: 32 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 24 }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i}>
            <div className="skeleton" style={{ aspectRatio: '4 / 5', marginBottom: 10 }} />
            <div className="skeleton" style={{ height: 18, width: '70%', marginBottom: 6 }} />
            <div className="skeleton" style={{ height: 14, width: '40%' }} />
          </div>
        ))}
      </div>
    </main>
  );
}
