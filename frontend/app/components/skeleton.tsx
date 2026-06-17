function Line({ width, height }: { width: string; height?: number }) {
  return <div className="skeleton-line" style={{ width, height }} />;
}

/**
 * Placeholder shown while a competitor's progression loads — mirrors the rough
 * shape of the real dashboard (summary, stat grid, two charts) so the layout
 * doesn't jump when data arrives.
 */
export function DashboardSkeleton() {
  return (
    <div className="skeleton-grid" aria-hidden="true">
      <div className="skeleton-panel">
        <Line width="40%" height={28} />
        <div style={{ height: 12 }} />
        <Line width="22%" />
      </div>

      <div className="skeleton-stats">
        {Array.from({ length: 6 }, (_, index) => (
          <div className="skeleton-metric" key={index}>
            <Line width="55%" height={10} />
            <Line width="75%" height={24} />
          </div>
        ))}
      </div>

      <div className="skeleton-panel">
        <Line width="30%" height={18} />
        <div className="skeleton-chart" />
      </div>

      <div className="skeleton-panel">
        <Line width="30%" height={18} />
        <div className="skeleton-chart" />
      </div>
    </div>
  );
}
