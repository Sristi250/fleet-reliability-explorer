import {
  CORRECTIVE_TYPES, FAILURE_DEFINITIONS, LABOUR_RATE_GBP, MAX_KM_PER_MONTH, UNMAPPED, WINDOW_END,
  type FailureDefinition,
} from './config'
import { groupBy, totalKm, type BusMonth, type FailureEvent, type FleetData } from './clean'
import { sum } from './stats'
import type { Model } from './types'

/** Distinct repairs (work orders or claims) that count as failures under a definition. */
export function countFailures(events: FailureEvent[], definition: FailureDefinition): number {
  const types: readonly string[] = FAILURE_DEFINITIONS[definition]
  return new Set(events.filter((e) => types.includes(e.failure_type)).map((e) => e.ref)).size
}

/** Mean distance between failures. Null when there were no failures. */
export function mdbf(km: number, failures: number): number | null {
  return failures > 0 ? km / failures : null
}

export interface ComponentRow {
  component: string
  system: string
  events: number
  parts_cost: number
  labour_hours: number
  labour_cost: number
  /** km driven by the models this component is fitted to. */
  km: number
  mdbf_km: number | null
  total_cost: number
  cost_per_1000km: number
  failures_per_100k_km: number
}

/** One row per component. Pass already-filtered events and exposure to slice it. */
export function componentTable(
  events: FailureEvent[], exposure: BusMonth[], fittedModels: Map<string, Model[]>,
): ComponentRow[] {
  const kmByModel = new Map<Model, number>()
  for (const [model, months] of groupBy(exposure, (m) => m.model)) kmByModel.set(model, totalKm(months))

  return [...groupBy(events, (e) => e.component)].map(([component, list]) => {
    const n = new Set(list.map((e) => e.ref)).size
    const km = sum((fittedModels.get(component) ?? ['DD', 'SD']).map((m) => kmByModel.get(m) ?? 0))
    const parts_cost = sum(list.map((e) => e.parts_cost))
    const labour_cost = sum(list.map((e) => e.labour_cost))
    const total_cost = parts_cost + labour_cost
    return {
      component,
      system: list[0].system,
      events: n,
      parts_cost,
      labour_hours: sum(list.map((e) => e.hours)),
      labour_cost,
      km,
      mdbf_km: mdbf(km, n),
      total_cost,
      cost_per_1000km: km > 0 ? (total_cost / km) * 1000 : 0,
      failures_per_100k_km: km > 0 ? (n / km) * 100_000 : 0,
    }
  })
}

// ---------- the numbers in expected_metrics.json ----------

interface MdbfSummary { events: number; km: number; mdbf_km: number }

/**
 * Computes the same structure as data-gen/expected_metrics.json, unrounded.
 * The tests compare the two; the app uses the building blocks above.
 */
export function referenceMetrics(data: FleetData) {
  const { raw, events, exposure, busMonths, allEvents } = data
  const fleetKm = totalKm(exposure)

  const mdbfByDefinition = Object.fromEntries(
    (Object.keys(FAILURE_DEFINITIONS) as FailureDefinition[]).map((d) => {
      const n = countFailures(events, d)
      return [d, { events: n, km: fleetKm, mdbf_km: fleetKm / n }]
    }),
  ) as Record<FailureDefinition, MdbfSummary>

  const byModel = Object.fromEntries(
    [...groupBy(exposure, (m) => m.model)].map(([model, months]) => {
      const km = totalKm(months)
      const n = new Set(events.filter((e) => e.model === model).map((e) => e.ref)).size
      return [model, { events: n, km, mdbf_km: km / n }]
    }),
  ) as Record<Model, MdbfSummary>

  const components = componentTable(events, exposure, data.fittedModels)
  const partsCost = sum(events.map((e) => e.parts_cost))
  const labourCost = sum(events.map((e) => e.labour_cost))

  // Naive versions, to show what each trap costs.
  const maxOdo = new Map<string, number>()
  for (const r of raw.odometer) maxOdo.set(r.body_number, Math.max(maxOdo.get(r.body_number) ?? -Infinity, r.odometer_km))
  const naiveKm = sum([...maxOdo.values()])
  const corrective = new Set<string>(CORRECTIVE_TYPES)
  const naiveFailures = raw.workshop.filter((l) => corrective.has(l.wo_type)).length + raw.warranty.length
  const firstLineHours = new Map<string, number | null>()
  for (const l of raw.workshop) if (!firstLineHours.has(l.wo_ref)) firstLineHours.set(l.wo_ref, l.wo_total_hours)

  const modelByFleet = new Map(raw.buses.map((b) => [b.fleet_number, b.model]))
  const modelByBody = new Map(raw.buses.map((b) => [b.body_number, b.model]))
  const wrongModel = raw.warranty.filter((l) => {
    const viaRef = modelByFleet.get(l.customer_fleet_ref)
    const viaBody = modelByBody.get(l.body_number)
    return viaRef === undefined || viaBody === undefined || viaRef !== viaBody
  }).length

  const descriptions = new Map<string, Set<string>>()
  for (const x of raw.xref) {
    if (x.part_number === '') continue
    const set = descriptions.get(x.part_number) ?? new Set()
    set.add(x.operator_description)
    descriptions.set(x.part_number, set)
  }

  return {
    window: { end: WINDOW_END, labour_rate_gbp: LABOUR_RATE_GBP, max_km_per_month: MAX_KM_PER_MONTH },
    fleet: {
      buses: raw.buses.length,
      km_covered: fleetKm,
      km_all_clean: totalKm(busMonths),
      imputed_months: busMonths.filter((m) => m.imputed).length,
    },
    mdbf: mdbfByDefinition,
    mdbf_by_model: byModel,
    components,
    unmapped_share_of_events: events.filter((e) => e.component === UNMAPPED).length / events.length,
    rm_cost: {
      parts_gbp: partsCost,
      labour_gbp: labourCost,
      warranty_share: sum(events.filter((e) => e.source === 'warranty').map((e) => e.parts_cost)) / partsCost,
      per_km_gbp: (partsCost + labourCost) / fleetKm,
    },
    naive: {
      km_sum_of_max_odometer: naiveKm,
      corrective_lines: naiveFailures,
      mdbf_km: naiveKm / naiveFailures,
      mdbf_km_ignoring_eam_coverage: totalKm(busMonths) / new Set(allEvents.map((e) => e.ref)).size,
      labour_hours_summed_per_line: sum(raw.workshop.map((l) => l.wo_total_hours ?? 0)),
      labour_hours_once_per_wo: sum([...firstLineHours.values()].map((h) => h ?? 0)),
      warranty_lines_wrong_model_via_fleet_ref: wrongModel / raw.warranty.length,
      parts_with_more_than_one_operator_description: [...descriptions.values()].filter((s) => s.size > 1).length,
    },
  }
}
