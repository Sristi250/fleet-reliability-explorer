/** Placeholder shaped like the view that's loading, so the layout doesn't jump. */
export function ViewSkeleton({ kind }: { kind: 'fleet' | 'components' | 'whatif' }) {
  return (
    <div className="skeleton-view" role="status">
      <span className="sr-only">Loading and cleaning the fleet data…</span>
      {kind === 'whatif' ? (
        <div className="skeleton-whatif" aria-hidden="true">
          <div className="skeleton skeleton-side" />
          <div>
            <div className="stats">
              <div className="skeleton skeleton-stat" />
              <div className="skeleton skeleton-stat" />
              <div className="skeleton skeleton-stat" />
            </div>
            <div className="skeleton skeleton-chart" />
          </div>
        </div>
      ) : (
        <div aria-hidden="true">
          <div className="skeleton skeleton-filters" />
          <div className="stats">
            <div className="skeleton skeleton-stat" />
            <div className="skeleton skeleton-stat" />
            <div className="skeleton skeleton-stat" />
          </div>
          <div className="skeleton skeleton-chart" />
        </div>
      )}
    </div>
  )
}
