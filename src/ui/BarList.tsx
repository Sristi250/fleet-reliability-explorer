import type { ReactNode } from 'react'

export interface Bar {
  key: string
  label: ReactNode
  value: number
  /** Text at the bar's tip. */
  display: string
  /** Secondary text under the label. */
  note?: ReactNode
  /** Draw in the muted colour (e.g. "Unmapped", or a non-failure row). */
  muted?: boolean
}

/**
 * Horizontal bars in HTML rather than SVG: labels wrap naturally on narrow
 * screens and each row can be a real button. Every value is printed, so no
 * hover is needed to read the chart.
 */
export function BarList({
  bars, selected, onSelect, ariaLabel, color = 'var(--series-1)',
}: {
  bars: Bar[]
  selected?: string | null
  onSelect?: (key: string) => void
  ariaLabel: string
  color?: string
}) {
  const max = Math.max(0, ...bars.map((b) => b.value)) || 1
  return (
    <ol className="bar-list" aria-label={ariaLabel}>
      {bars.map((b) => {
        const content = (
          <>
            <span className="bar-label">
              <span>{b.label}</span>
              {b.note && <span className="bar-note">{b.note}</span>}
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
            {onSelect ? (
              <button type="button" className="bar-button" aria-pressed={selected === b.key} onClick={() => onSelect(b.key)}>
                {content}
              </button>
            ) : <div className="bar-static">{content}</div>}
          </li>
        )
      })}
    </ol>
  )
}
