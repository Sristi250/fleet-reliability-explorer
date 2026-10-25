// Cleaning rules. Each function mirrors one in data-gen/reference_metrics.py,
// and the trap numbers refer to docs/data.md.

import {
  COMPLAINT_TYPE, CORRECTIVE_TYPES, LABOUR_RATE_GBP, MAX_KM_PER_MONTH, UNMAPPED, WINDOW_END,
  type FailureType,
} from './config'
import { median, sum } from './stats'
import type { Bus, Model, Part, RawTables } from './types'

// ---------- months ----------

/** Months since year 0, so ranges are simple integer loops. */
export function monthIndex(isoDate: string): number {
  return Number(isoDate.slice(0, 4)) * 12 + Number(isoDate.slice(5, 7)) - 1
}

/** First day of the month, as YYYY-MM-01. */
export function monthStart(index: number): string {
  const y = Math.floor(index / 12)
  const m = (index % 12) + 1
  return `${y}-${String(m).padStart(2, '0')}-01`
}

function nextDay(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

// ---------- exposure (km) ----------

export interface BusMonth {
  body_number: string
  month: string // YYYY-MM-01
  km: number
  /** The raw value was implausible and was replaced by the bus's median month. */
  imputed: boolean
  model: Model
  depot: string
  batch: string
  /** Inside the analysis window: after the depot's EAM go-live, up to WINDOW_END. */
  covered: boolean
}

/**
 * Clean km per bus per month from cumulative odometer readings (traps 6 and 7).
 *
 * A reading higher than any later reading is a spike and is dropped. A bus
 * starts at 0 km at the end of the month before it entered service. km between
 * two good readings is spread evenly over the months between them. A month
 * still above MAX_KM_PER_MONTH gets the bus's median month instead.
 */
export function monthlyKm(raw: RawTables, eamGoLive: Map<string, string>): BusMonth[] {
  const readings = groupBy(raw.odometer, (r) => r.body_number)
  const out: BusMonth[] = []

  for (const bus of raw.buses) {
    const r = [...(readings.get(bus.body_number) ?? [])]
      .sort((a, b) => a.reading_date.localeCompare(b.reading_date))

    // Keep a reading only if no later reading is lower.
    const keep: boolean[] = new Array(r.length)
    let laterMin = Infinity
    for (let i = r.length - 1; i >= 0; i--) {
      laterMin = Math.min(laterMin, r[i].odometer_km)
      keep[i] = r[i].odometer_km <= laterMin
    }

    const rows: { month: number; km: number }[] = []
    let fromMonth = monthIndex(bus.in_service_date)
    let prevKm = 0
    r.forEach((reading, i) => {
      if (!keep[i]) return
      const toMonth = monthIndex(reading.reading_date)
      const n = toMonth - fromMonth + 1
      for (let m = fromMonth; m <= toMonth; m++) {
        rows.push({ month: m, km: (reading.odometer_km - prevKm) / n })
      }
      fromMonth = monthIndex(nextDay(reading.reading_date))
      prevKm = reading.odometer_km
    })

    const typical = median(rows.filter((x) => x.km <= MAX_KM_PER_MONTH).map((x) => x.km))
    const goLive = eamGoLive.get(bus.depot)
    for (const { month, km } of rows) {
      const imputed = km > MAX_KM_PER_MONTH
      const start = monthStart(month)
      out.push({
        body_number: bus.body_number,
        month: start,
        km: imputed ? (typical ?? 0) : km,
        imputed,
        model: bus.model,
        depot: bus.depot,
        batch: bus.batch,
        covered: isCovered(start, goLive),
      })
    }
  }
  return out
}

function isCovered(month: string, goLive: string | undefined): boolean {
  return goLive !== undefined && month >= goLive && month <= WINDOW_END
}

// ---------- failure events ----------

export type Source = 'workshop' | 'warranty'

export interface FailureEvent {
  /** Work order or claim reference. One repair can produce several events (one per component). */
  ref: string
  source: Source
  component: string
  system: string
  date: string
  month: string
  failure_type: FailureType
  qty: number
  parts_cost: number
  /** Hours booked on the work order, before splitting. Null for warranty. */
  wo_hours: number | null
  body_number: string | null
  model: Model | null
  depot: string | null
  batch: string | null
  covered: boolean
  /** Filled in for covered events by addLabour. */
  hours: number
  labour_cost: number
}

export function classifyComplaint(text: string): FailureType {
  for (const [pattern, type] of COMPLAINT_TYPE) if (pattern.test(text)) return type
  return 'Unclassified'
}

/**
 * One event per (work order or claim, component) where a non-consumable part
 * was used: net quantity after returns is above zero (traps 2, 3, 4, 8, 9, 11).
 */
export function componentEvents(
  raw: RawTables, eamGoLive: Map<string, string>, kind: 'failures' | 'consumables' = 'failures',
): FailureEvent[] {
  const wantConsumables = kind === 'consumables'
  const parts = new Map(raw.parts.map((p) => [p.part_number, p]))
  const xref = new Map(raw.xref.map((x) => [x.operator_part_code, x.part_number]))
  const busByFleet = new Map(raw.buses.map((b) => [b.fleet_number, b]))
  const busByBody = new Map(raw.buses.map((b) => [b.body_number, b]))
  const corrective = new Set<string>(CORRECTIVE_TYPES)

  const events = new Map<string, FailureEvent>()
  const event = (key: string, init: () => FailureEvent) => {
    let e = events.get(key)
    if (!e) events.set(key, (e = init()))
    return e
  }

  for (const line of raw.workshop) {
    if (!corrective.has(line.wo_type)) continue
    const part = parts.get(xref.get(line.operator_part_code) ?? '')
    if ((part?.is_consumable ?? false) !== wantConsumables) continue
    const component = part?.component ?? UNMAPPED
    const e = event(`${line.wo_ref}\u0000${component}`, () =>
      newEvent(line.wo_ref, 'workshop', component, part, line.wo_date,
        line.wo_type as FailureType, busByFleet.get(line.fleet_number), eamGoLive))
    e.qty += line.qty
    e.parts_cost += line.qty * (part?.list_price_gbp ?? 0)
    e.wo_hours ??= line.wo_total_hours // first non-blank, as pandas "first" does
  }

  for (const line of raw.warranty) {
    const part = parts.get(line.part_number)
    if (!part || part.is_consumable !== wantConsumables) continue
    const e = event(`${line.claim_ref}\u0000${part.component}`, () =>
      newEvent(line.claim_ref, 'warranty', part.component, part, line.repair_date,
        classifyComplaint(line.complaint), busByBody.get(line.body_number), eamGoLive))
    e.qty += line.qty
    e.parts_cost += line.part_cost_gbp
  }

  return [...events.values()].filter((e) => e.qty > 0)
}

function newEvent(
  ref: string, source: Source, component: string, part: Part | undefined, date: string,
  failure_type: FailureType, bus: Bus | undefined, eamGoLive: Map<string, string>,
): FailureEvent {
  const month = monthStart(monthIndex(date))
  return {
    ref, source, component, system: part?.system ?? 'Unmapped', date, month, failure_type,
    qty: 0, parts_cost: 0, wo_hours: null,
    body_number: bus?.body_number ?? null,
    model: bus?.model ?? null,
    depot: bus?.depot ?? null,
    batch: bus?.batch ?? null,
    covered: isCovered(month, bus && eamGoLive.get(bus.depot)),
    hours: 0, labour_cost: 0,
  }
}

/**
 * Hours are booked once per work order (trap 1), so split them over its
 * components. Warranty claims carry no hours: use the component's median from
 * single-component work orders, or the overall median if it has none.
 */
export function addLabour(events: FailureEvent[], labourRate = LABOUR_RATE_GBP): void {
  const perRef = new Map<string, number>()
  for (const e of events) perRef.set(e.ref, (perRef.get(e.ref) ?? 0) + 1)

  const single = events.filter((e) => e.source === 'workshop' && perRef.get(e.ref) === 1 && e.wo_hours !== null)
  const byComponent = new Map<string, number[]>()
  for (const e of single) {
    const list = byComponent.get(e.component) ?? []
    list.push(e.wo_hours!)
    byComponent.set(e.component, list)
  }
  const overall = median(single.map((e) => e.wo_hours!)) ?? 0

  for (const e of events) {
    e.hours = e.wo_hours !== null
      ? e.wo_hours / perRef.get(e.ref)!
      : median(byComponent.get(e.component) ?? []) ?? overall
    e.labour_cost = e.hours * labourRate
  }
}

// ---------- the cleaned model ----------

export interface FleetData {
  raw: RawTables
  buses: Bus[]
  /** Every clean bus-month, covered or not. */
  busMonths: BusMonth[]
  /** Bus-months inside the analysis window: the km for MDBF. */
  exposure: BusMonth[]
  /** Every failure event, covered or not. */
  allEvents: FailureEvent[]
  /** Failure events inside the analysis window, with labour. */
  events: FailureEvent[]
  /**
   * Consumables used on corrective work (cable ties, coolant...), grouped the
   * same way. Never failures (trap 3); only shown when asked for. No labour.
   */
  consumableEvents: FailureEvent[]
  /** Models each component is fitted to, for component MDBF. */
  fittedModels: Map<string, Model[]>
}

export function buildFleetData(raw: RawTables): FleetData {
  const eamGoLive = new Map(raw.depots.map((d) => [d.depot, d.eam_go_live]))
  const busMonths = monthlyKm(raw, eamGoLive)
  const allEvents = componentEvents(raw, eamGoLive)
  const events = allEvents.filter((e) => e.covered)
  addLabour(events)

  const fittedModels = new Map<string, Model[]>()
  for (const p of raw.parts) {
    if (!p.is_consumable && !fittedModels.has(p.component)) fittedModels.set(p.component, p.models)
  }
  fittedModels.set(UNMAPPED, ['DD', 'SD'])

  return {
    raw,
    buses: raw.buses,
    busMonths,
    exposure: busMonths.filter((m) => m.covered),
    allEvents,
    events,
    consumableEvents: componentEvents(raw, eamGoLive, 'consumables').filter((e) => e.covered),
    fittedModels,
  }
}

export function totalKm(months: BusMonth[]): number {
  return sum(months.map((m) => m.km))
}

export function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const out = new Map<K, T[]>()
  for (const item of items) {
    const k = key(item)
    const list = out.get(k)
    if (list) list.push(item)
    else out.set(k, [item])
  }
  return out
}
