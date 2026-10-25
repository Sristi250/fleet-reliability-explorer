export interface Segment {
  key: string
  label: string
  color: string
}

/**
 * Horizontal stacked bars on one shared scale. Values are written under each
 * bar, not inside the fills: no text colour reaches 4.5:1 on every series fill.
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
    <div className="stacked" role="group" aria-label={ariaLabel}>
      <ul className="legend" aria-hidden="true">
        {segments.map((s) => <li key={s.key}><span className="key-swatch" style={{ background: s.color }} />{s.label}</li>)}
      </ul>
      {rows.map((r, i) => (
        <div key={r.key} className="stacked-row">
          <div className="stacked-label">{r.label}<span className="stacked-total">{format(totals[i])}</span></div>
          <div className="stacked-track" aria-hidden="true">
            {segments.map((s) => (
              <div key={s.key} className="stacked-seg" style={{ width: `${((r.values[s.key] ?? 0) / max) * 100}%`, background: s.color }} />
            ))}
          </div>
          <ul className="stacked-values">
            {segments.map((s) => (
              <li key={s.key}>
                <span className="key-swatch" style={{ background: s.color }} aria-hidden="true" />
                {s.label} <strong>{format(r.values[s.key] ?? 0)}</strong>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
