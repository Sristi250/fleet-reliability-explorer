import { useMemo, useState } from 'react'
import { FAILURE_DEFINITION_LABELS, FAILURE_DEFINITIONS, type FailureDefinition } from '../data/config'
import type { FleetData } from '../data/clean'
import { sum } from '../data/stats'
import type { Model } from '../data/types'
import { headline, mdbfBy, mdbfTrend, sliceData, type Slice } from '../data/views'
import { BarList } from '../ui/BarList'
import { ChartCard, DataTable, MethodNote } from '../ui/ChartCard'
import { AnimatedNumber, Delta, FilterBar, Segmented, Stat } from '../ui/controls'
import { Sparkline } from '../ui/Sparkline'
import { EmptySlice, SliceFilters, type DepotInfo } from '../ui/SliceFilters'
import { fmt } from '../ui/format'
import { LineChart, type LineSeries } from '../ui/LineChart'
import { MODEL_COLOR, MODEL_LABEL } from '../ui/models'

const DEFINITION_OPTIONS = (Object.keys(FAILURE_DEFINITIONS) as FailureDefinition[])
  .map((d) => ({ value: d, label: FAILURE_DEFINITION_LABELS[d] }))

/** MDBF over the last six months, and its change against the six before. */
function halfYearChange(points: { km: number; failures: number }[]) {
  if (points.length < 12) return null
  const last = points.slice(-6)
  const prev = points.slice(-12, -6)
  const failures = (p: typeof last) => sum(p.map((x) => x.failures))
  // With no failures in either half there is no MDBF to compare.
  if (failures(last) === 0 || failures(prev) === 0) return null
  const m = (p: typeof last) => sum(p.map((x) => x.km)) / failures(p)
  return { recent: m(last), change: m(last) / m(prev) - 1 }
}

/** One plain sentence answering "Is reliability improving?". */
function answer(trend: { recent: number; change: number } | null, overall: number | null): string {
  if (!trend) return `MDBF over the whole window is ${fmt.km(overall)}; there isn't a full year of data to compare.`
  const { recent, change } = trend
  const pct = fmt.pct(Math.abs(change))
  if (Math.abs(change) < 0.02) return `Holding steady: MDBF over the last 6 months was ${fmt.km(recent)}, about the same as the 6 months before.`
  return change > 0
    ? `Yes: MDBF over the last 6 months was ${fmt.km(recent)}, ${pct} higher than the 6 months before.`
    : `Not at the moment: MDBF over the last 6 months was ${fmt.km(recent)}, ${pct} lower than the 6 months before.`
}

export function FleetHealth({ data, slice, setSlice, depots }: {
  data: FleetData; slice: Slice; setSlice: (s: Slice) => void; depots: DepotInfo[]
}) {
  const [def, setDef] = useState<FailureDefinition>('breakdowns')
  const { events, exposure } = useMemo(() => sliceData(data, slice), [data, slice])
  const head = useMemo(() => headline(events, exposure, def), [events, exposure, def])

  const trends = useMemo(() => {
    const models: Model[] = slice.model === 'all' ? ['DD', 'SD'] : [slice.model]
    return models.map((m) => ({
      model: m,
      points: mdbfTrend(events.filter((e) => e.model === m), exposure.filter((x) => x.model === m), def),
    }))
  }, [events, exposure, def, slice.model])
  const fleetTrend = useMemo(() => mdbfTrend(events, exposure, def), [events, exposure, def])
  const change = halfYearChange(fleetTrend)
  const labels = fleetTrend.map((p) => p.month)
  const series: LineSeries[] = trends.map((t) => {
    const byMonth = new Map(t.points.map((p) => [p.month, p.rolling_mdbf]))
    return {
      id: t.model, label: MODEL_LABEL[t.model], color: MODEL_COLOR[t.model],
      values: labels.map((m) => byMonth.get(m) ?? null),
    }
  })

  // Depot comparison ignores the depot filter (so you can compare) but keeps the model filter.
  const byDepot = useMemo(() => {
    const s = sliceData(data, { ...slice, depot: 'all' })
    return mdbfBy(s.events, s.exposure, def, 'depot').sort((a, b) => (b.mdbf ?? 0) - (a.mdbf ?? 0))
  }, [data, slice, def])
  const goLive = new Map(data.raw.depots.map((d) => [d.depot, d.eam_go_live]))
  // The table mirrors the chart: one MDBF column per plotted model, plus the fleet.
  const tableRows = labels.map((month, i) => ({
    month,
    fleet: fleetTrend[i],
    byModel: Object.fromEntries(series.map((s) => [s.id, s.values[i]])) as Record<string, number | null>,
  }))

  return (
    <>
      {exposure.length > 0 && <p className="view-answer">{answer(change, head.mdbf)}</p>}
      <FilterBar>
        <Segmented label="Count as a Failure" value={def} options={DEFINITION_OPTIONS} onChange={setDef} />
        <SliceFilters slice={slice} setSlice={setSlice} depots={depots} />
      </FilterBar>

      {exposure.length === 0 ? <EmptySlice slice={slice} setSlice={setSlice} /> : <>
      <div className="stats">
        <Stat
          hero
          label={`MDBF · ${FAILURE_DEFINITION_LABELS[def]}`}
          value={<AnimatedNumber value={head.mdbf} format={fmt.km} />}
          trend={<Sparkline values={fleetTrend.map((p) => p.rolling_mdbf)} />}
          sub={change === null ? 'Whole analysis window' : (
            <Delta change={change.change} goodWhenUp text={`${fmt.signedPct(change.change)} vs previous 6 months`} />
          )}
        />
        <Stat
          label="Failures Counted"
          value={<AnimatedNumber value={head.failures} format={(n) => (n === null ? '–' : fmt.int(n))} />}
          trend={<Sparkline values={fleetTrend.map((p) => p.failures)} color="var(--muted-fill)" />}
          sub="Distinct repairs · monthly trend"
        />
        <Stat
          label="Distance Covered"
          value={<AnimatedNumber value={head.km} format={fmt.distance} />}
          trend={<Sparkline values={fleetTrend.map((p) => p.km)} color="var(--muted-fill)" />}
          sub={`${fmt.count(head.buses, 'bus', 'buses')} · monthly trend`}
        />
      </div>

      <ChartCard
        title="MDBF Trend"
        subtitle="Rolling 3 months, by model. Higher is better."
        table={
          <DataTable
            caption="Monthly Distance, Failures and Rolling 3-Month MDBF"
            rowKey={(r) => r.month}
            rows={tableRows}
            columns={[
              { key: 'm', header: 'Month', cell: (r) => fmt.month(r.month) },
              ...series.map((s) => ({
                key: s.id, header: `${s.label} MDBF`, numeric: true, cell: (r: (typeof tableRows)[number]) => fmt.km(r.byModel[s.id]),
              })),
              { key: 'mdbf', header: 'Fleet MDBF', numeric: true, cell: (r) => fmt.km(r.fleet.rolling_mdbf) },
              { key: 'f', header: 'Failures', numeric: true, cell: (r) => fmt.int(r.fleet.failures) },
              { key: 'km', header: 'Distance (km)', numeric: true, cell: (r) => fmt.int(r.fleet.km) },
            ]}
          />
        }
      >
        {labels.length > 0 ? (
          <LineChart
            labels={labels}
            series={series}
            formatY={(n) => fmt.compact(n)}
            formatValue={fmt.km}
            yLabel="km between failures"
            formatX={fmt.monthShort}
            formatTooltipX={(m) => `3 months to ${fmt.month(m)}`}
            ariaLabel={`Rolling 3-month MDBF by month for ${series.map((s) => s.label).join(' and ')}`}
          />
        ) : <p className="empty">No km recorded for this selection.</p>}
      </ChartCard>

      <ChartCard
        title="MDBF by Depot"
        subtitle={slice.model === 'all' ? 'All models. Higher is better.' : `${MODEL_LABEL[slice.model]} only. Higher is better.`}
        table={
          <DataTable
            caption="MDBF by Depot"
            rowKey={(r) => r.key}
            rows={byDepot}
            columns={[
              { key: 'd', header: 'Depot', cell: (r) => r.key },
              { key: 'g', header: 'On EAM Since', cell: (r) => fmt.month(goLive.get(r.key) ?? '') },
              { key: 'b', header: 'Buses', numeric: true, cell: (r) => r.buses },
              { key: 'km', header: 'Distance (km)', numeric: true, cell: (r) => fmt.int(r.km) },
              { key: 'f', header: 'Failures', numeric: true, cell: (r) => fmt.int(r.failures) },
              { key: 'mdbf', header: 'MDBF', numeric: true, cell: (r) => fmt.km(r.mdbf) },
            ]}
          />
        }
      >
        {/* Read-only on purpose: the depot filter above is the one place that changes the depot. */}
        <BarList
          ariaLabel="MDBF by depot"
          labelHeader="Depot"
          valueHeader="MDBF"
          selected={slice.depot === 'all' ? null : slice.depot}
          bars={byDepot.map((r) => ({
            key: r.key,
            label: r.key,
            note: `${fmt.count(r.buses, 'bus', 'buses')} · ${fmt.count(r.failures, 'failure')} · on EAM since ${fmt.month(goLive.get(r.key) ?? '')}`,
            value: r.mdbf ?? 0,
            display: fmt.km(r.mdbf),
          }))}
        />
      </ChartCard>
      </>}

      <MethodNote title="How This Is Counted">
          <li><strong>MDBF</strong> (mean distance between failures) = km driven ÷ failures, using the same bus-months for both.</li>
          <li>Each depot is counted only after it joined the operator's maintenance system (EAM). Before that, most failures were never recorded, so including them would make reliability look better than it was.</li>
          <li>A failure is one repair (work order or warranty claim) that used a non-consumable part. Ten rivets on one job are one failure, and returned parts are netted off.</li>
          <li>Warranty claims have no failure type, so it is read from the complaint text. About half of all breakdowns only appear on warranty claims.</li>
          <li>The window ends on 31 May 2026: later repairs are still being claimed.</li>
      </MethodNote>
    </>
  )
}
