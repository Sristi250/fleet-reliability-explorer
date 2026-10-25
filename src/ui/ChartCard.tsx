import { useId, useState, type ReactNode } from 'react'
import { InfoIcon } from './icons'

/** The "how this is counted" callout under a view. */
export function MethodNote({ title, children }: { title: string; children: ReactNode }) {
  return (
    <aside className="method" aria-label={title}>
      <span className="method-icon"><InfoIcon /></span>
      <h3>{title}</h3>
      <ul>{children}</ul>
    </aside>
  )
}

export interface Column<R> {
  key: string
  header: string
  cell: (row: R) => ReactNode
  numeric?: boolean
}

export function DataTable<R>({ columns, rows, caption, rowKey }: {
  columns: Column<R>[]; rows: R[]; caption: string; rowKey: (r: R) => string
}) {
  return (
    // Focusable so keyboard users can scroll it; named apart from the card it sits in.
    <div className="table-wrap" tabIndex={0} role="region" aria-label={`${caption} (table)`}>
      <table className="data-table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>{columns.map((c) => <th key={c.key} scope="col" className={c.numeric ? 'num' : undefined}>{c.header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={rowKey(r)}>
              {columns.map((c, i) => i === 0
                ? <th key={c.key} scope="row">{c.cell(r)}</th>
                : <td key={c.key} className={c.numeric ? 'num' : undefined}>{c.cell(r)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** A titled card with a chart, and a button to swap it for the same data as a table. */
export function ChartCard({ title, subtitle, children, table, actions, className }: {
  title: string
  subtitle?: ReactNode
  children: ReactNode
  table?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  const [showTable, setShowTable] = useState(false)
  const headingId = useId()
  return (
    <section className={`card ${className ?? ''}`} aria-labelledby={headingId}>
      <header className="card-head">
        <div>
          <h3 id={headingId} className="card-title">{title}</h3>
          {subtitle && <p className="card-sub">{subtitle}</p>}
        </div>
        <div className="card-actions">
          {actions}
          {table && (
            <button type="button" className="btn-ghost" aria-pressed={showTable} onClick={() => setShowTable((s) => !s)}>
              {showTable ? 'Show Chart' : 'Show Table'}
            </button>
          )}
        </div>
      </header>
      {showTable && table ? table : children}
    </section>
  )
}
