import { useMemo, useState } from 'react'
import { UNMAPPED } from '../data/config'
import { totalKm, type FleetData } from '../data/clean'
import { ALL, DEFAULT_ASSUMPTIONS, paretoRows, whatIf, type Assumptions } from '../data/views'
import { ChartCard, DataTable } from '../ui/ChartCard'
import { NumberField, Stat } from '../ui/controls'
import { fmt } from '../ui/format'
import { StackedBars, type Segment } from '../ui/StackedBars'

const CANDIDATES = 15

const SEGMENTS: Segment[] = [
  { key: 'bus', label: 'Bus price', color: 'var(--series-1)' },
  { key: 'rm', label: 'R&M (corrective)', color: 'var(--series-2)' },
  { key: 'energy', label: 'Energy', color: 'var(--series-3)' },
]

export function RmWhatIf({ data }: { data: FleetData }) {
  const [a, setA] = useState<Assumptions>(DEFAULT_ASSUMPTIONS)
  const [improvement, setImprovement] = useState(25)

  // Candidates: the costliest components fleet-wide, ignoring the unmapped bucket.
  const candidates = useMemo(
    () => paretoRows(data, ALL, 'total_cost').filter((r) => r.component !== UNMAPPED).slice(0, CANDIDATES),
    [data],
  )
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(candidates.slice(0, 5).map((r) => r.component)))

  const improvements = useMemo(
    () => new Map([...chosen].map((c) => [c, improvement])),
    [chosen, improvement],
  )
  const r = useMemo(() => whatIf(data, improvements, a), [data, improvements, a])
  const total = (t: typeof r.tco) => t.bus + t.rm + t.energy
  const share = (t: typeof r.tco) => (total(t) > 0 ? t.rm / total(t) : 0)
  const rmShare = share(r.tco)
  const rmShareAfter = share(r.tcoAfter)
  const set = (k: keyof Assumptions) => (v: number) => setA((prev) => ({ ...prev, [k]: v }))
  const toggle = (c: string) => setChosen((prev) => {
    const next = new Set(prev)
    if (next.has(c)) next.delete(c)
    else next.add(c)
    return next
  })

  const fleetKm = useMemo(() => totalKm(data.exposure), [data])
  const perRowSaving = (cost: number) => {
    const x = improvement / 100
    return (cost / fleetKm) * (x / (1 + x)) * a.kmPerYear
  }

  return (
    <div className="whatif">
      <div className="whatif-inputs">
        <section className="card" aria-labelledby="improve-h">
          <h2 id="improve-h" className="card-title">Improve reliability</h2>
          <div className="slider">
            <label htmlFor="improve">MDBF improvement on chosen components</label>
            <div className="slider-row">
              <input id="improve" type="range" min={0} max={200} step={5} value={improvement}
                onChange={(e) => setImprovement(e.target.valueAsNumber)} aria-valuetext={`${improvement} percent`} />
              <output htmlFor="improve" className="slider-value">+{improvement}%</output>
            </div>
            <p className="hint">+100% MDBF means half as many failures.</p>
          </div>
          <fieldset className="choices">
            <legend>Components (costliest {CANDIDATES} fleet-wide)</legend>
            {candidates.map((c) => (
              <label key={c.component} className="choice">
                <input type="checkbox" checked={chosen.has(c.component)} onChange={() => toggle(c.component)} />
                <span className="choice-name">{c.component}</span>
                <span className="choice-meta">{fmt.gbp2(c.cost_per_1000km)} / 1,000 km</span>
              </label>
            ))}
          </fieldset>
        </section>

        <section className="card" aria-labelledby="assume-h">
          <h2 id="assume-h" className="card-title">Assumptions</h2>
          <div className="fields">
            <NumberField label="Labour rate" unit="£/h" value={a.labourRate} onChange={set('labourRate')} />
            <NumberField label="Bus price" unit="£" step={5000} value={a.busPrice} onChange={set('busPrice')} />
            <NumberField label="Energy use" unit="kWh/km" step={0.05} value={a.kwhPerKm} onChange={set('kwhPerKm')} />
            <NumberField label="Electricity" unit="£/kWh" step={0.01} value={a.gbpPerKwh} onChange={set('gbpPerKwh')} />
            <NumberField label="Life" unit="years" value={a.lifeYears} onChange={set('lifeYears')} />
            <NumberField label="Distance" unit="km/year" step={1000} value={a.kmPerYear} onChange={set('kmPerYear')} />
          </div>
          <button type="button" className="btn-ghost" onClick={() => setA(DEFAULT_ASSUMPTIONS)}>Reset assumptions</button>
        </section>
      </div>

      <div className="whatif-results">
        <div className="stats">
          <Stat hero label="Saving per bus per year" value={fmt.gbp(r.savingPerBusYear)}
            sub={`${fmt.gbp(r.savingFleetYear)} a year across ${r.fleetBuses} buses`} />
          <Stat label="Corrective R&M per km" value={fmt.gbp3(r.rmPerKmAfter)} sub={`from ${fmt.gbp3(r.rmPerKm)}`} />
          <Stat label="R&M share of TCO" value={fmt.pct(rmShareAfter, 1)} sub={`from ${fmt.pct(rmShare, 1)}`} />
        </div>

        <ChartCard
          title="Lifetime cost per bus"
          subtitle={`TCO = bus price + R&M + energy, over ${a.lifeYears} years and ${fmt.compact(a.kmPerYear * a.lifeYears)} km.`}
          table={
            <DataTable
              caption="Lifetime cost per bus, before and after"
              rowKey={(row) => row.key}
              rows={[{ key: 'Today', t: r.tco }, { key: 'With improvement', t: r.tcoAfter }]}
              columns={[
                { key: 'k', header: 'Scenario', cell: (row) => row.key },
                { key: 'b', header: 'Bus price', numeric: true, cell: (row) => fmt.gbp(row.t.bus) },
                { key: 'r', header: 'R&M', numeric: true, cell: (row) => fmt.gbp(row.t.rm) },
                { key: 'e', header: 'Energy', numeric: true, cell: (row) => fmt.gbp(row.t.energy) },
                { key: 't', header: 'Total', numeric: true, cell: (row) => fmt.gbp(total(row.t)) },
              ]}
            />
          }
        >
          <StackedBars
            ariaLabel={`Lifetime cost per bus: today ${fmt.gbp(total(r.tco))}, with improvement ${fmt.gbp(total(r.tcoAfter))}`}
            segments={SEGMENTS}
            format={fmt.gbpCompact}
            rows={[
              { key: 'now', label: 'Today', values: r.tco },
              { key: 'after', label: 'With improvement', values: r.tcoAfter },
            ]}
          />
        </ChartCard>

        <ChartCard title="Where the saving comes from" subtitle={`Per bus per year, at +${improvement}% MDBF.`}>
          {chosen.size === 0 ? <p className="empty">Choose at least one component.</p> : (
            <DataTable
              caption="Saving by component"
              rowKey={(row) => row.component}
              rows={candidates.filter((c) => chosen.has(c.component))}
              columns={[
                { key: 'c', header: 'Component', cell: (row) => row.component },
                { key: 'f', header: 'Failures now', numeric: true, cell: (row) => fmt.int(row.events) },
                { key: 'm', header: 'MDBF now', numeric: true, cell: (row) => fmt.km(row.mdbf_km) },
                { key: 'cost', header: 'Cost now', numeric: true, cell: (row) => fmt.gbp(row.parts_cost + row.labour_hours * a.labourRate) },
                { key: 's', header: 'Saving / bus / yr', numeric: true, cell: (row) => fmt.gbp2(perRowSaving(row.parts_cost + row.labour_hours * a.labourRate)) },
              ]}
            />
          )}
        </ChartCard>

        <aside className="method">
          <h2>What this covers</h2>
          <ul>
            <li>R&M here is corrective repairs only: parts plus labour on failures. Preventive maintenance, tyres and accident damage are out of scope.</li>
            <li>Costs come from the whole fleet in the analysis window; the model and depot filters don't apply here.</li>
            <li>Parts are list prices; warranty parts use claimed cost. Warranty labour is estimated from the median workshop hours for the same component.</li>
            <li>Bus price, energy and life are placeholder assumptions. Change them to match a real quote.</li>
          </ul>
        </aside>
      </div>
    </div>
  )
}
