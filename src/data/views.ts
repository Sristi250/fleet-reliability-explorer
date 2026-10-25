// Aggregations behind each view. All of them take the cleaned FleetData and a
// slice, so every chart is computed the same way as the tested metrics.

import { FAILURE_DEFINITIONS, UNMAPPED, type FailureDefinition } from './config'
import { groupBy, monthIndex, monthStart, totalKm, type BusMonth, type FailureEvent, type FleetData } from './clean'
import { componentTable, countFailures, mdbf, type ComponentRow } from './metrics'
import { sum } from './stats'
import type { Model } from './types'

export interface Slice {
  model: Model | 'all'
  depot: string | 'all'
}

export const ALL: Slice = { model: 'all', depot: 'all' }

function inSlice(slice: Slice) {
  return (x: { model: Model | null; depot: string | null }) =>
    (slice.model === 'all' || x.model === slice.model) && (slice.depot === 'all' || x.depot === slice.depot)
}

export function sliceData(data: FleetData, slice: Slice) {
  const keep = inSlice(slice)
  return { events: data.events.filter(keep), exposure: data.exposure.filter(keep) }
}

// ---------- fleet health ----------

export interface Headline {
  km: number
  failures: number
  mdbf: number | null
  buses: number
}

export function headline(events: FailureEvent[], exposure: BusMonth[], def: FailureDefinition): Headline {
  const km = totalKm(exposure)
  const failures = countFailures(events, def)
  return { km, failures, mdbf: mdbf(km, failures), buses: new Set(exposure.map((m) => m.body_number)).size }
}

export interface TrendPoint {
  month: string
  km: number
  failures: number
  /** MDBF over the trailing window ending this month. Null until the window is full or with no failures. */
  rolling_mdbf: number | null
}

/**
 * Monthly failures and km, with MDBF over a trailing window. A single month is
 * too noisy for breakdown-only MDBF (about 40 a month fleet-wide), so the line
 * is smoothed.
 */
export function mdbfTrend(
  events: FailureEvent[], exposure: BusMonth[], def: FailureDefinition, windowMonths = 3,
): TrendPoint[] {
  const types: readonly string[] = FAILURE_DEFINITIONS[def]
  const kmByMonth = new Map<string, number>()
  for (const [month, rows] of groupBy(exposure, (m) => m.month)) kmByMonth.set(month, totalKm(rows))
  const refsByMonth = new Map<string, Set<string>>()
  for (const e of events) {
    if (!types.includes(e.failure_type)) continue
    const set = refsByMonth.get(e.month) ?? new Set()
    set.add(e.ref)
    refsByMonth.set(e.month, set)
  }
  const months = [...kmByMonth.keys()].sort()
  if (months.length === 0) return []
  const first = monthIndex(months[0])
  const last = monthIndex(months[months.length - 1])

  const points: TrendPoint[] = []
  for (let i = first; i <= last; i++) {
    const month = monthStart(i)
    points.push({ month, km: kmByMonth.get(month) ?? 0, failures: refsByMonth.get(month)?.size ?? 0, rolling_mdbf: null })
  }
  points.forEach((p, i) => {
    if (i < windowMonths - 1) return
    const window = points.slice(i - windowMonths + 1, i + 1)
    p.rolling_mdbf = mdbf(sum(window.map((w) => w.km)), sum(window.map((w) => w.failures)))
  })
  return points
}

export interface GroupMdbf extends Headline {
  key: string
}

export function mdbfBy(
  events: FailureEvent[], exposure: BusMonth[], def: FailureDefinition, key: 'depot' | 'model' | 'batch',
): GroupMdbf[] {
  const eventsBy = groupBy(events, (e) => e[key])
  return [...groupBy(exposure, (m) => m[key])].map(([k, months]) => ({
    key: k,
    ...headline(eventsBy.get(k) ?? [], months, def),
  }))
}

// ---------- component pareto ----------

export type RankBy = 'events' | 'total_cost' | 'labour_hours' | 'cost_per_1000km'

export interface ParetoRow extends ComponentRow {
  consumable: boolean
}

export function paretoRows(
  data: FleetData, slice: Slice, rankBy: RankBy, includeConsumables = false,
): ParetoRow[] {
  const { events, exposure } = sliceData(data, slice)
  const rows: ParetoRow[] = componentTable(events, exposure, data.fittedModels).map((r) => ({ ...r, consumable: false }))
  if (includeConsumables) {
    const consumables = data.consumableEvents.filter(inSlice(slice))
    rows.push(...componentTable(consumables, exposure, data.fittedModels).map((r) => ({ ...r, consumable: true })))
  }
  return rows.sort((a, b) => b[rankBy] - a[rankBy])
}

/** Running share of the total, for the Pareto "top N = X%" readout. */
export function cumulativeShare(rows: ComponentRow[], rankBy: RankBy): number[] {
  const total = sum(rows.map((r) => r[rankBy]))
  let running = 0
  return rows.map((r) => (running += r[rankBy]) / total)
}

export interface BatchRate {
  batch: string
  model: Model
  depot: string
  buses: number
  events: number
  km: number
  per_100k_km: number
}

/** Failure rate of one component by delivery batch: how a bad batch shows up. */
export function componentByBatch(data: FleetData, component: string, slice: Slice): BatchRate[] {
  const fitted = data.fittedModels.get(component) ?? ['DD', 'SD']
  const { events, exposure } = sliceData(data, slice)
  const compEvents = groupBy(events.filter((e) => e.component === component), (e) => e.batch)
  return [...groupBy(exposure.filter((m) => fitted.includes(m.model)), (m) => m.batch)]
    .map(([batch, months]) => {
      const km = totalKm(months)
      const n = new Set((compEvents.get(batch) ?? []).map((e) => e.ref)).size
      return {
        batch,
        model: months[0].model,
        depot: months[0].depot,
        buses: new Set(months.map((m) => m.body_number)).size,
        events: n,
        km,
        per_100k_km: km > 0 ? (n / km) * 100_000 : 0,
      }
    })
    .sort((a, b) => b.per_100k_km - a.per_100k_km)
}

export interface QuarterPoint {
  quarter: string // e.g. 2025 Q2
  month: string // first month of the quarter
  focus: number | null
  rest: number | null
}

/** Quarterly failures per 100k km for one batch against the rest of the fleet. */
export function batchVsRest(data: FleetData, component: string, batch: string, slice: Slice): QuarterPoint[] {
  const fitted = data.fittedModels.get(component) ?? ['DD', 'SD']
  const { events, exposure } = sliceData(data, slice)
  const quarter = (month: string) => {
    const i = monthIndex(month)
    return monthStart(i - (i % 12) % 3)
  }
  const acc = new Map<string, { kmF: number; kmR: number; nF: Set<string>; nR: Set<string> }>()
  const get = (q: string) => {
    let a = acc.get(q)
    if (!a) acc.set(q, (a = { kmF: 0, kmR: 0, nF: new Set(), nR: new Set() }))
    return a
  }
  for (const m of exposure) {
    if (!fitted.includes(m.model)) continue
    const a = get(quarter(m.month))
    if (m.batch === batch) a.kmF += m.km
    else a.kmR += m.km
  }
  for (const e of events) {
    if (e.component !== component) continue
    const a = get(quarter(e.month))
    ;(e.batch === batch ? a.nF : a.nR).add(e.ref)
  }
  return [...acc.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, a]) => ({
      month,
      quarter: `${month.slice(0, 4)} Q${Math.floor((Number(month.slice(5, 7)) - 1) / 3) + 1}`,
      focus: a.kmF > 0 ? (a.nF.size / a.kmF) * 100_000 : null,
      rest: a.kmR > 0 ? (a.nR.size / a.kmR) * 100_000 : null,
    }))
}

// ---------- R&M what-if ----------

export interface Assumptions {
  labourRate: number
  busPrice: number
  kwhPerKm: number
  gbpPerKwh: number
  lifeYears: number
  kmPerYear: number
}

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  labourRate: 45,
  busPrice: 450_000,
  kwhPerKm: 1.1,
  gbpPerKwh: 0.25,
  lifeYears: 15,
  kmPerYear: 57_000,
}

export interface WhatIfResult {
  /** Corrective R&M per km now, at the chosen labour rate. */
  rmPerKm: number
  rmPerKmAfter: number
  savingPerBusYear: number
  savingFleetYear: number
  fleetBuses: number
  tco: { bus: number; rm: number; energy: number }
  tcoAfter: { bus: number; rm: number; energy: number }
}

/**
 * Improving a component's MDBF by X% means failures fall to 1 / (1 + X) of
 * today's, so its cost per km falls by X / (1 + X). Costs are corrective R&M
 * only (parts + labour); preventive maintenance is out of scope.
 */
export function whatIf(
  data: FleetData, improvements: Map<string, number>, a: Assumptions,
): WhatIfResult {
  const fleetKm = totalKm(data.exposure)
  const byComponent = groupBy(data.events, (e) => e.component)
  let cost = 0
  let saved = 0
  for (const [component, list] of byComponent) {
    const c = sum(list.map((e) => e.parts_cost + e.hours * a.labourRate))
    cost += c
    const x = (improvements.get(component) ?? 0) / 100
    saved += c * (x / (1 + x))
  }
  const rmPerKm = cost / fleetKm
  const rmPerKmAfter = (cost - saved) / fleetKm
  const lifeKm = a.kmPerYear * a.lifeYears
  const energy = lifeKm * a.kwhPerKm * a.gbpPerKwh
  const savingPerBusYear = (rmPerKm - rmPerKmAfter) * a.kmPerYear
  return {
    rmPerKm,
    rmPerKmAfter,
    savingPerBusYear,
    fleetBuses: data.buses.length,
    savingFleetYear: savingPerBusYear * data.buses.length,
    tco: { bus: a.busPrice, rm: rmPerKm * lifeKm, energy },
    tcoAfter: { bus: a.busPrice, rm: rmPerKmAfter * lifeKm, energy },
  }
}

export { UNMAPPED }
