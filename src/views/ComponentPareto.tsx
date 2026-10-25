import * as m from 'motion/react-m'
import { useMemo, useState } from 'react'
import { UNMAPPED } from '../data/config'
import type { FleetData } from '../data/clean'
import {
  batchVsRest, componentByBatch, cumulativeShare, paretoRows, type ParetoRow, type RankBy, type Slice,
} from '../data/views'
import { BarList } from '../ui/BarList'
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
  // A filter can remove the selected component; then show the empty state.
  const selectedRow = rows.find((r) => r.component === selected)

  return (
    <>
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
          sub={`Out of ${named.length} named components with failures`}
        />
        <Stat
          label="Unmapped Operator Codes"
          value={<AnimatedNumber value={unmapped ? unmapped.events / Math.max(1, totalFailures) : 0} format={(n) => fmt.pct(n ?? 0)} />}
          sub="Of failures can't be tied to a component yet"
        />
      </div>

      <div className="pareto-grid">
        <ChartCard
          title={`Components Ranked by ${rankLabel}`}
          subtitle={`Top ${SHOW}. Select one to see which batches drive it.`}
          table={
            <DataTable
              caption="All Components"
              rowKey={(r) => `${r.component}${r.consumable}`}
              rows={rows}
              columns={[
                { key: 'c', header: 'Component', cell: (r) => r.consumable ? `${fmt.title(r.component)} (Consumable)` : fmt.title(r.component) },
                { key: 's', header: 'System', cell: (r) => fmt.title(r.system) },
                { key: 'e', header: 'Failures', numeric: true, cell: (r) => fmt.int(r.events) },
                { key: 'r', header: 'Per 100k km', numeric: true, cell: (r) => fmt.num(r.failures_per_100k_km, 2) },
                { key: 'm', header: 'MDBF', numeric: true, cell: (r) => fmt.km(r.mdbf_km) },
                { key: 'p', header: 'Parts Cost', numeric: true, cell: (r) => fmt.gbp(r.parts_cost) },
                { key: 'h', header: 'Labour Hours', numeric: true, cell: (r) => r.consumable ? '–' : fmt.int(r.labour_hours) },
                { key: 't', header: 'Total Cost', numeric: true, cell: (r) => fmt.gbp(r.total_cost) },
                { key: 'k', header: '£ per 1,000 km', numeric: true, cell: (r) => fmt.gbp2(r.cost_per_1000km) },
              ]}
            />
          }
        >
          <BarList
            ariaLabel={`Components ranked by ${rankLabel}`}
            selected={selected}
            onSelect={(c) => setSelected((s) => (s === c ? null : c))}
            bars={rows.slice(0, SHOW).map((r) => ({
              key: r.component,
              label: r.consumable ? `${fmt.title(r.component)} · Consumable` : fmt.title(r.component),
              note: r.component === UNMAPPED
                ? 'Operator part codes with no cross-reference yet'
                : r.consumable ? 'Not a failure: used on repairs, not replaced because it broke' : fmt.title(r.system),
              value: r[rankBy],
              display: RANK_FORMAT[rankBy](r),
              muted: r.component === UNMAPPED || r.consumable,
            }))}
          />
        </ChartCard>

        {selectedRow
          ? <Drilldown key={selectedRow.component} data={data} slice={slice} row={selectedRow} onClose={() => setSelected(null)} />
          : (
            <aside className="card drill-empty" aria-label="Component Detail">
              <span className="drill-empty-icon"><SearchChartIcon /></span>
              <h3 className="card-title">Pick a Component</h3>
              <p>Select a component to see its failure rate by delivery batch and over time.</p>
              <p className="hint">Try <button type="button" className="link" onClick={() => setSelected('Door control unit')}>{fmt.title('Door control unit')}</button>.</p>
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
  const quarters = useMemo(() => batchVsRest(data, row.component, focus, slice), [data, row.component, focus, slice])
  const fleetRate = row.failures_per_100k_km

  return (
    <m.section
      className="card drill"
      aria-label={`${fmt.title(row.component)} Detail`}
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
    >
      <header className="card-head">
        <div>
          <h3 className="card-title">{fmt.title(row.component)}</h3>
          <p className="card-sub">{row.consumable ? 'Consumable (not counted as a failure)' : fmt.title(row.system)}</p>
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
            ? 'Consumables are excluded from failure counts. They are shown so you can see how much they would crowd the list.'
            : 'These failures used an operator part code with no match in the parts cross-reference. Mapping the most common codes is the quickest way to make this list more accurate.'}
        </p>
      ) : (
        <>
          <h4 className="sub-title">Failures per 100k km by Delivery Batch</h4>
          <p className="card-sub">Fleet rate for this component: {fmt.num(fleetRate, 2)}. Select a batch to compare it over time.</p>
          <BarList
            ariaLabel="Failures per 100k km by batch"
            selected={focus}
            onSelect={setFocus}
            bars={batches.slice(0, 8).map((b) => ({
              key: b.batch,
              label: b.batch,
              note: `${b.depot} · ${MODEL_LABEL[b.model]} · ${b.buses} buses · ${b.events} failures`,
              value: b.per_100k_km,
              display: fmt.num(b.per_100k_km, 2),
            }))}
          />
          {focus && (
            <>
              <h4 className="sub-title">{focus} vs the Rest of the Fleet</h4>
              <LineChart
                height={220}
                labels={quarters.map((q) => q.month)}
                formatX={(m) => quarters.find((q) => q.month === m)?.quarter ?? m}
                formatY={(n) => fmt.num(n, n < 10 ? 1 : 0)}
                yLabel="failures per 100k km"
                ariaLabel={`Quarterly failures per 100k km for ${focus} and the rest of the fleet`}
                series={[
                  { id: 'focus', label: focus, color: 'var(--series-2)', values: quarters.map((q) => q.focus) },
                  { id: 'rest', label: 'Rest of Fleet', color: 'var(--series-1)', values: quarters.map((q) => q.rest) },
                ]}
              />
            </>
          )}
        </>
      )}
    </m.section>
  )
}
