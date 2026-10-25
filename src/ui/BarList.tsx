export interface Bar {
  key: string
  label: string
  value: number
  /** Text at the bar's tip. */
  display: string
  /** Secondary text under the label (one line; the full text shows on hover). */
  note?: string
  /** Draw in the muted colour (e.g. "Unmapped", or a non-failure row). */
  muted?: boolean
  /** Shown after a divider, e.g. a selected row from outside the top N. */
  detached?: boolean
}

/**
 * Horizontal bars in HTML rather than SVG: labels lay out naturally and each
 * row can be a real button. Every value is printed, so no hover is needed to
 * read the chart. The header names the value column, so values carry units.
 */
export function BarList({
  bars, selected, onSelect, ariaLabel, labelHeader, valueHeader, color = 'var(--series-1)',
}: {
  bars: Bar[]
  selected?: string | null
  onSelect?: (key: string) => void
  ariaLabel: string
  labelHeader: string
  valueHeader: string
  color?: string
}) {
  const max = Math.max(0, ...bars.map((b) => b.value)) || 1
  return (
    <div>
      <div className="bar-head" aria-hidden="true">
        <span>{labelHeader}</span>
        <span />
        <span>{valueHeader}</span>
      </div>
      <ol className="bar-list" aria-label={`${ariaLabel} (${valueHeader})`}>
        {bars.map((b) => {
          const content = (
            <>
              <span className="bar-label">
                <span title={b.label}>{b.label}</span>
                {b.note && <span className="bar-note" title={b.note}>{b.note}</span>}
              </span>
              <span className="bar-track" aria-hidden="true">
                <span
                  className="bar-fill"
                  style={{ width: `${(b.value / max) * 100}%`, background: b.muted ? 'var(--muted-fill)' : color }}
                />
              </span>
              <span className="bar-value">{b.display}</span>
            </>
          )
          return (
            <li key={b.key} className={selected === b.key ? 'bar-row is-selected' : 'bar-row'}>
              {b.detached && <div className="bar-divider" aria-hidden="true" />}
              {onSelect ? (
                <button type="button" className="bar-button" aria-pressed={selected === b.key} onClick={() => onSelect(b.key)}>
                  {content}
                </button>
              ) : <div className="bar-static">{content}</div>}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
