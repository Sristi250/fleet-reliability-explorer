export interface Segment {
  key: string
  label: string
  color: string
  /** Text colour inside the fill: white, or near-black on light fills. */
  ink?: string
}

/**
 * Horizontal stacked bars on one shared scale. Segment values are printed
 * inside the fill only when there is room; the legend and the table carry the rest.
 */
export function StackedBars({
  rows, segments, format, ariaLabel,
}: {
  rows: { key: string; label: string; values: Record<string, number> }[]
  segments: Segment[]
  format: (n: number) => string
  ariaLabel: string
}) {
  const totals = rows.map((r) => segments.reduce((s, seg) => s + (r.values[seg.key] ?? 0), 0))
  const max = Math.max(...totals) || 1
  return (
    <div className="stacked" role="img" aria-label={ariaLabel}>
      <ul className="legend" aria-hidden="true">
        {segments.map((s) => <li key={s.key}><span className="key-swatch" style={{ background: s.color }} />{s.label}</li>)}
      </ul>
      {rows.map((r, i) => (
        <div key={r.key} className="stacked-row">
          <div className="stacked-label">{r.label}<span className="stacked-total">{format(totals[i])}</span></div>
          <div className="stacked-track">
            {segments.map((s) => {
              const v = r.values[s.key] ?? 0
              const pct = (v / max) * 100
              return (
                <div key={s.key} className="stacked-seg" style={{ width: `${pct}%`, background: s.color, color: s.ink ?? '#fff' }}>
                  {pct > 14 && <span>{format(v)}</span>}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
