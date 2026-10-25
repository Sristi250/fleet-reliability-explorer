/**
 * A tiny trend line for a stat tile. Decorative: the full series is in the
 * chart's table view, so it is hidden from screen readers.
 */
export function Sparkline({ values, color = 'var(--accent)', height = 32 }: {
  values: (number | null)[]
  color?: string
  height?: number
}) {
  const points = values.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v !== null)
  if (points.length < 2) return null
  const W = 100 // viewBox width; the SVG stretches to the tile
  const min = Math.min(...points.map((p) => p.v))
  const max = Math.max(...points.map((p) => p.v))
  const span = max - min || 1
  const pad = 3
  const x = (i: number) => (i / (values.length - 1)) * W
  const y = (v: number) => pad + (1 - (v - min) / span) * (height - pad * 2)
  const d = points.map((p, k) => `${k ? 'L' : 'M'}${x(p.i).toFixed(2)},${y(p.v).toFixed(2)}`).join('')
  const area = `${d}L${x(points.at(-1)!.i).toFixed(2)},${height}L${x(points[0].i).toFixed(2)},${height}Z`
  const last = points.at(-1)!

  return (
    <div className="sparkline" aria-hidden="true">
      <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" height={height}>
        <path d={area} fill={color} opacity={0.1} />
        <path d={d} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </svg>
      {/* The end dot sits outside the stretched SVG so it stays round. */}
      <span
        className="sparkline-dot"
        style={{ left: `${(x(last.i) / W) * 100}%`, top: `${(y(last.v) / height) * 100}%`, background: color }}
      />
    </div>
  )
}
