/** Placeholder shaped like a view, shown while the data loads, so the layout doesn't jump. */
export function ViewSkeleton() {
  return (
    <div className="skeleton-view" role="status">
      <span className="sr-only">Loading and cleaning the fleet data…</span>
      <div className="skeleton skeleton-filters" aria-hidden="true" />
      <div className="stats" aria-hidden="true">
        <div className="skeleton skeleton-stat" />
        <div className="skeleton skeleton-stat" />
        <div className="skeleton skeleton-stat" />
      </div>
      <div className="skeleton skeleton-chart" aria-hidden="true" />
    </div>
  )
}
