// Checks the TypeScript pipeline against data-gen/expected_metrics.json, which
// an independent pandas implementation writes. If these two disagree, one of
// them has a bug.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import { buildFleetData, classifyComplaint, monthIndex, monthStart, type FleetData } from './clean'
import { referenceMetrics } from './metrics'
import { parseTables, TABLE_FILES, type CsvTexts } from './parse'
import { median } from './stats'

const root = new URL('../../', import.meta.url)
const expected = JSON.parse(readFileSync(new URL('data-gen/expected_metrics.json', root), 'utf8'))

function loadFromDisk(): FleetData {
  const texts = Object.fromEntries(
    Object.entries(TABLE_FILES).map(([table, file]) => [
      table,
      readFileSync(fileURLToPath(new URL(`public/data/${file}`, root)), 'utf8'),
    ]),
  ) as CsvTexts
  return buildFleetData(parseTables(texts))
}

/** The golden file is rounded; accept anything that rounds to the same value. */
function close(actual: number, expectedValue: number, decimals: number) {
  const tolerance = 0.5 * 10 ** -decimals + 1e-9 * Math.max(1, Math.abs(expectedValue))
  expect(Math.abs(actual - expectedValue), `${actual} vs ${expectedValue}`).toBeLessThanOrEqual(tolerance)
}

describe('helpers', () => {
  it('handles month arithmetic across a year end', () => {
    expect(monthStart(monthIndex('2025-12-31') + 1)).toBe('2026-01-01')
  })
  it('takes the median like pandas', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 2, 3])).toBe(2.5)
    expect(median([])).toBeNull()
  })
  it('classifies warranty complaint text (trap 11)', () => {
    expect(classifyComplaint('Vehicle failed in service - no drive')).toBe('Breakdown')
    expect(classifyComplaint('Driver reported door button faulty')).toBe('Driver Defect')
    expect(classifyComplaint('Found at inspection')).toBe('Work Arising')
    expect(classifyComplaint('Something else')).toBe('Unclassified')
  })
})

describe('matches the pandas reference implementation', () => {
  let m: ReturnType<typeof referenceMetrics>
  beforeAll(() => {
    m = referenceMetrics(loadFromDisk())
  })

  it('fleet km and odometer cleaning', () => {
    expect(m.fleet.buses).toBe(expected.fleet.buses)
    close(m.fleet.km_covered, expected.fleet.km_covered, 0)
    close(m.fleet.km_all_clean, expected.fleet.km_all_clean, 0)
    expect(m.fleet.imputed_months).toBe(expected.fleet.imputed_months)
  })

  it('MDBF under all three failure definitions', () => {
    for (const [name, e] of Object.entries<{ events: number; km: number; mdbf_km: number }>(expected.mdbf)) {
      const a = m.mdbf[name as keyof typeof m.mdbf]
      expect(a.events, name).toBe(e.events)
      close(a.mdbf_km, e.mdbf_km, 0)
    }
  })

  it('MDBF by model', () => {
    for (const [model, e] of Object.entries<{ events: number; km: number; mdbf_km: number }>(expected.mdbf_by_model)) {
      const a = m.mdbf_by_model[model as 'DD' | 'SD']
      expect(a.events, model).toBe(e.events)
      close(a.km, e.km, 0)
      close(a.mdbf_km, e.mdbf_km, 0)
    }
  })

  for (const [list, sortKey, size] of [
    ['top_components_by_events', 'events', 15],
    ['top_components_by_cost', 'total_cost', 10],
  ] as const) {
    it(`component table: ${list}`, () => {
      const ranked = [...m.components].sort((a, b) => b[sortKey] - a[sortKey]).slice(0, size)
      // Same values in the same rank order (names can swap where values tie).
      ranked.forEach((row, i) => close(row[sortKey], expected[list][i][sortKey], 2))

      for (const e of expected[list]) {
        const a = m.components.find((c) => c.component === e.component)
        expect(a, e.component).toBeDefined()
        expect(a!.events, e.component).toBe(e.events)
        close(a!.km, e.km, 0)
        close(a!.mdbf_km!, e.mdbf_km, 0)
        for (const k of ['parts_cost', 'labour_hours', 'labour_cost', 'total_cost', 'cost_per_1000km'] as const) {
          close(a![k], e[k], 2)
        }
      }
    })
  }

  it('unmapped share and R&M cost', () => {
    close(m.unmapped_share_of_events, expected.unmapped_share_of_events, 4)
    close(m.rm_cost.parts_gbp, expected.rm_cost.parts_gbp, 2)
    close(m.rm_cost.labour_gbp, expected.rm_cost.labour_gbp, 2)
    close(m.rm_cost.warranty_share, expected.rm_cost.warranty_share, 4)
    close(m.rm_cost.per_km_gbp, expected.rm_cost.per_km_gbp, 4)
  })

  it('naive numbers (what each trap costs)', () => {
    const n = expected.naive
    close(m.naive.km_sum_of_max_odometer, n.km_sum_of_max_odometer, 0)
    expect(m.naive.corrective_lines).toBe(n.corrective_lines)
    close(m.naive.mdbf_km, n.mdbf_km, 0)
    close(m.naive.mdbf_km_ignoring_eam_coverage, n.mdbf_km_ignoring_eam_coverage, 0)
    close(m.naive.labour_hours_summed_per_line, n.labour_hours_summed_per_line, 1)
    close(m.naive.labour_hours_once_per_wo, n.labour_hours_once_per_wo, 1)
    close(m.naive.warranty_lines_wrong_model_via_fleet_ref, n.warranty_lines_wrong_model_via_fleet_ref, 4)
    expect(m.naive.parts_with_more_than_one_operator_description).toBe(n.parts_with_more_than_one_operator_description)
  })
})
