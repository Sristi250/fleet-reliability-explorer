import * as m from 'motion/react-m'
import { useEffect, useMemo, useRef, useState } from 'react'
import { UNMAPPED } from '../data/config'
import type { FleetData } from '../data/clean'
import {
  batchVsRest, componentByBatch, cumulativeShare, paretoRows, type ParetoRow, type RankBy, type Slice,
} from '../data/views'
import { BarList, type Bar } from '../ui/BarList'
import { ChartCard, DataTable } from '../ui/ChartCard'
import { AnimatedNumber, FilterBar, Segmented, Stat } from '../ui/controls'
import { EmptySlice, SliceFilters, type DepotInfo } from '../ui/SliceFilters'
import { fmt } from '../ui/format'
import { SearchChartIcon } from '../ui/icons'
import { LineChart } from '../ui/LineChart'
import { MODEL_LABEL } from '../ui/models'

const RANK_OPTIONS: { value: RankBy; label: string }[] = [
  { value: 'events', label: 'Failures' },
  { value: 'total_cost', label: 'Total Cost' },
  { value: 'labour_hours', label: 'Labour Hours' },
  { value: 'cost_per_1000km', label: 'Cost per 1,000 km' },
]

const RANK_FORMAT: Record<RankBy, (r: ParetoRow) => string> = {
  events: (r) => fmt.int(r.events),
  total_cost: (r) => fmt.gbp(r.total_cost),
  labour_hours: (r) => `${fmt.int(r.labour_hours)} h`,
  cost_per_1000km: (r) => fmt.gbp2(r.cost_per_1000km),
}

const SHOW = 20
/** The planted storyline: a bad batch fixed by a campaign. Offered as a starting point. */
const STORY_COMPONENT = 'Door control unit'

function componentLabel(r: ParetoRow) {
  return r.consumable ? `${fmt.title(r.component)} · Consumable` : fmt.title(r.component)
}

function componentNote(r: ParetoRow) {
  if (r.component === UNMAPPED) return 'No component match yet'
  if (r.consumable) return 'Used during repairs; not a failed part'
  return fmt.title(r.system)
}

export function ComponentPareto({ data, slice, setSlice, depots }: {
  data: FleetData; slice: Slice; setSlice: (s: Slice) => void; depots: DepotInfo[]
}) {
  const [rankBy, setRankBy] = useState<RankBy>('events')
  const [consumables, setConsumables] = useState(false)
  // The selected component lives in the URL (#components?c=...) so a drill-down can be shared.
  const [selected, setSelectedState] = useState<string | null>(
    () => new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('c'),
  )
  const setSelected = (next: string | null | ((s: string | null) => string | null)) => {
    const value = typeof next === 'function' ? next(selected) : next
    setSelectedState(value)
    history.replaceState(null, '', value ? `#components?c=${encodeURIComponent(value)}` : '#components')
  }

  const rows = useMemo(() => paretoRows(data, slice, rankBy, consumables), [data, slice, rankBy, consumables])
  const failureRows = rows.filter((r) => !r.consumable)
  // Concentration among named components; the unmapped bucket isn't one component.
  const named = failureRows.filter((r) => r.component !== UNMAPPED)
  const share = cumulativeShare(named, rankBy)
  const top10 = share[Math.min(9, share.length - 1)] ?? 0
  const unmapped = failureRows.find((r) => r.component === UNMAPPED)
  const totalFailures = failureRows.reduce((s, r) => s + r.events, 0)
  const rankLabel = RANK_OPTIONS.find((o) => o.value === rankBy)!.label
  const leader = named[0]
  // A filter can remove the selected component; then show the empty state.
  const selectedRow = rows.find((r) => r.component === selected)
  const selectedIndex = selectedRow ? rows.indexOf(selectedRow) : -1

  const toBar = (r: ParetoRow, rank: number, detached = false): Bar => ({
    key: r.component,
    label: detached ? `#${rank} ${componentLabel(r)}` : componentLabel(r),
    note: componentNote(r),
    value: r[rankBy],
    display: RANK_FORMAT[rankBy](r),
    muted: r.component === UNMAPPED || r.consumable,
    detached,
  })
  const bars = rows.slice(0, SHOW).map((r, i) => toBar(r, i + 1))
  // A selection outside the top 20 is still shown, under a divider, with its rank.
  if (selectedRow && selectedIndex >= SHOW) bars.push(toBar(selectedRow, selectedIndex + 1, true))

  const quickPicks = [...named.slice(0, 3), ...named.filter((r) => r.component === STORY_COMPONENT)]
    .filter((r, i, all) => all.findIndex((x) => x.component === r.component) === i)

  return (
    <>
      {leader && (
        <p className="view-answer">
          The top 10 components account for {fmt.pct(top10)} of {rankLabel.toLowerCase()}; {fmt.title(leader.component)} is
          {' '}#1 ({RANK_FORMAT[rankBy](leader)}).
        </p>
      )}
      <FilterBar>
        <Segmented label="Rank By" value={rankBy} options={RANK_OPTIONS} onChange={setRankBy} />
        <SliceFilters slice={slice} setSlice={setSlice} depots={depots} />
        <label className="check">
          <input type="checkbox" checked={consumables} onChange={(e) => setConsumables(e.target.checked)} />
          Show Consumables
        </label>
      </FilterBar>

      {failureRows.length === 0 ? <EmptySlice slice={slice} setSlice={setSlice} /> : <>
      <div className="stats">
        <Stat
          hero
          label={`Top 10 Components' Share of ${rankLabel}`}
          value={<AnimatedNumber value={top10} format={(n) => fmt.pct(n ?? 0)} />}
          sub={`Out of ${fmt.count(named.length, 'named component')} with failures`}
        />
        <Stat
          label={`Top Component by ${rankLabel}`}
          value={<span className="stat-text">{leader ? fmt.title(leader.component) : '–'}</span>}
          sub={leader ? `${RANK_FORMAT[rankBy](leader)} · ${fmt.title(leader.system)}` : undefined}
        />
        <Stat
          label="Failures With No Component Match"
          value={<AnimatedNumber value={unmapped ? unmapped.events / Math.max(1, totalFailures) : 0} format={(n) => fmt.pct(n ?? 0)} />}
          sub={unmapped ? `${fmt.count(unmapped.events, 'failure')} with unmatched part codes` : 'Every part code is matched'}
        />
      </div>

      <div className="pareto-grid">
        <ChartCard
          title={`Components Ranked by ${rankLabel}`}
          subtitle={`Top ${SHOW}. Select one to see which delivery batches drive it.`}
          table={
            <>
              <p className="card-note">All {fmt.count(rows.length, 'component')}, ranked by {rankLabel.toLowerCase()}.</p>
              <DataTable
                caption={`All Components Ranked by ${rankLabel}`}
                rowKey={(r) => `${r.component}${r.consumable}`}
                rows={rows}
                columns={[
                  { key: 'c', header: 'Component', cell: componentLabel },
                  { key: 'e', header: 'Failures', numeric: true, cell: (r) => fmt.int(r.events) },
                  { key: 'm', header: 'MDBF', numeric: true, cell: (r) => fmt.km(r.mdbf_km) },
                  { key: 't', header: 'Total Cost', numeric: true, cell: (r) => fmt.gbp(r.total_cost) },
                  { key: 'k', header: 'Cost per 1,000 km', numeric: true, cell: (r) => fmt.gbp2(r.cost_per_1000km) },
                ]}
              />
            </>
          }
        >
          <BarList
            ariaLabel={`Components ranked by ${rankLabel.toLowerCase()}`}
            labelHeader="Component"
            valueHeader={rankLabel}
            selected={selected}
            onSelect={(c) => setSelected((s) => (s === c ? null : c))}
            bars={bars}
          />
        </ChartCard>

        {selectedRow
          ? <Drilldown key={selectedRow.component} data={data} slice={slice} row={selectedRow} onClose={() => setSelected(null)} />
          : (
            <aside className="card drill-empty" aria-label="Component Detail">
              <span className="drill-empty-icon"><SearchChartIcon /></span>
              <h3 className="card-title">Pick a Component</h3>
              <p>See its failure rate by delivery batch and how that changed over time.</p>
              <ul className="quick-picks">
                {quickPicks.map((r) => (
                  <li key={r.component}>
                    <button type="button" onClick={() => setSelected(r.component)}>
                      <span>{fmt.title(r.component)}</span>
                      <small>{r.component === STORY_COMPONENT ? 'Has a bad batch' : RANK_FORMAT[rankBy](r)}</small>
                    </button>
                  </li>
                ))}
              </ul>
            </aside>
          )}
      </div>
      </>}
    </>
  )
}

function Drilldown({ data, slice, row, onClose }: {
  data: FleetData; slice: Slice; row: ParetoRow; onClose: () => void
}) {
  const batches = useMemo(() => componentByBatch(data, row.component, slice), [data, row.component, slice])
  const [focus, setFocus] = useState(batches[0]?.batch ?? '')
  const [showTable, setShowTable] = useState(false)
  const quarters = useMemo(() => batchVsRest(data, row.component, focus, slice), [data, row.component, focus, slice])
  const ref = useRef<HTMLElement>(null)

  // On one-column layouts the panel opens below the list: bring it into view.
  useEffect(() => {
    if (window.matchMedia('(max-width: 900px)').matches) {
      const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ref.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' })
    }
  }, [])

  const rate = (n: number) => fmt.num(n, 2)
  return (
    <m.section
      ref={ref}
      className="card drill"
      aria-label={`${fmt.title(row.component)} Detail`}
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
    >
      <header className="card-head">
        <div>
          <h3 className="card-title">{fmt.title(row.component)}</h3>
          <p className="card-sub">{row.consumable ? 'Consumable, not counted as a failure' : fmt.title(row.system)}</p>
        </div>
        <button type="button" className="btn-ghost" onClick={onClose}>Close</button>
      </header>
      <div className="stats stats-compact">
        <Stat label="Failures" value={fmt.int(row.events)} />
        <Stat label="MDBF" value={fmt.km(row.mdbf_km)} />
        <Stat label="Total Cost" value={fmt.gbp(row.total_cost)} />
      </div>

      {row.component === UNMAPPED || row.consumable ? (
        <p className="empty">
          {row.consumable
            ? 'Consumables are left out of failure counts. They are shown so you can see how much they would crowd the list.'
            : 'These failures used a part code with no match in the parts cross-reference. Matching the most common codes is the quickest way to make this list more complete.'}
        </p>
      ) : (
        <>
          <div className="sub-head">
            <h4 className="sub-title">Failures per 100k km by Delivery Batch</h4>
            <button type="button" className="btn-ghost" aria-pressed={showTable} onClick={() => setShowTable((s) => !s)}>
              {showTable ? 'Show Charts' : 'Show Tables'}
            </button>
          </div>
          <p className="card-note">
            Fleet rate for this component: {rate(row.failures_per_100k_km)} per 100k km. Select a batch to compare it over time.
          </p>
          {showTable ? (
            <DataTable
              caption="Failures per 100k km by Delivery Batch"
              rowKey={(b) => b.batch}
              rows={batches}
              columns={[
                { key: 'b', header: 'Batch', cell: (b) => b.batch },
                { key: 'd', header: 'Depot', cell: (b) => b.depot },
                { key: 'm', header: 'Model', cell: (b) => MODEL_LABEL[b.model] },
                { key: 'n', header: 'Buses', numeric: true, cell: (b) => b.buses },
                { key: 'f', header: 'Failures', numeric: true, cell: (b) => b.events },
                { key: 'r', header: 'Per 100k km', numeric: true, cell: (b) => rate(b.per_100k_km) },
              ]}
            />
          ) : (
            <BarList
              ariaLabel="Failures per 100k km by batch"
              labelHeader="Batch"
              valueHeader="Per 100k km"
              selected={focus}
              onSelect={setFocus}
              bars={batches.slice(0, 8).map((b) => ({
                key: b.batch,
                label: b.batch,
                note: `${b.depot} · ${MODEL_LABEL[b.model]} · ${fmt.count(b.buses, 'bus', 'buses')} · ${fmt.count(b.events, 'failure')}`,
                value: b.per_100k_km,
                display: rate(b.per_100k_km),
              }))}
            />
          )}
          {focus && (
            <>
              <h4 className="sub-title">{focus} vs Rest of Fleet</h4>
              <p className="card-note">Failures per 100k km, by quarter. Gaps are quarters before the batch entered service.</p>
              {showTable ? (
                <DataTable
                  caption={`${focus} vs Rest of Fleet by Quarter`}
                  rowKey={(q) => q.month}
                  rows={quarters}
                  columns={[
                    { key: 'q', header: 'Quarter', cell: (q) => q.quarter },
                    { key: 'f', header: focus, numeric: true, cell: (q) => (q.focus === null ? '–' : rate(q.focus)) },
                    { key: 'r', header: 'Rest of Fleet', numeric: true, cell: (q) => (q.rest === null ? '–' : rate(q.rest)) },
                  ]}
                />
              ) : (
                // Neutral colours: blue and orange mean double-deck and single-deck everywhere else.
                <LineChart
                  height={220}
                  labels={quarters.map((q) => q.month)}
                  formatX={(mo) => quarters.find((q) => q.month === mo)?.quarter ?? mo}
                  formatY={(n) => (Number.isInteger(n) ? String(n) : n.toFixed(1))}
                  formatValue={(n) => `${rate(n)} per 100k km`}
                  yLabel="failures per 100k km"
                  ariaLabel={`Quarterly failures per 100k km for ${focus} and the rest of the fleet`}
                  series={[
                    { id: 'focus', label: focus, color: 'var(--ink)', values: quarters.map((q) => q.focus) },
                    { id: 'rest', label: 'Rest of Fleet', color: 'var(--muted-fill)', values: quarters.map((q) => q.rest) },
                  ]}
                />
              )}
            </>
          )}
        </>
      )}
    </m.section>
  )
}
