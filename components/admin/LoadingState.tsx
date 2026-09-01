export function LoadingBlock({ height = 220 }: { height?: number }) {
  return <div className="skeleton" style={{ width: '100%', height }} />;
}

export function LoadingRows({ rows = 4, height = 18 }: { rows?: number; height?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton" style={{ width: `${85 - i * 8}%`, height }} />
      ))}
    </div>
  );
}
