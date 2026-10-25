import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import { buildFleetData, totalKm, type FleetData } from './clean'
import { parseTables, TABLE_FILES, type CsvTexts } from './parse'
import { sum } from './stats'
import {
  ALL, batchVsRest, componentByBatch, DEFAULT_ASSUMPTIONS, headline, mdbfBy, mdbfTrend, paretoRows, whatIf,
} from './views'

const root = new URL('../../', import.meta.url)
const expected = JSON.parse(readFileSync(new URL('data-gen/expected_metrics.json', root), 'utf8'))

let data: FleetData
beforeAll(() => {
  const texts = Object.fromEntries(
    Object.entries(TABLE_FILES).map(([t, f]) => [t, readFileSync(fileURLToPath(new URL(`public/data/${f}`, root)), 'utf8')]),
  ) as CsvTexts
  data = buildFleetData(parseTables(texts))
})

describe('view aggregations', () => {
  it('monthly trend adds up to the fleet totals', () => {
    const trend = mdbfTrend(data.events, data.exposure, 'all_corrective')
    expect(sum(trend.map((p) => p.failures))).toBe(expected.mdbf.all_corrective.events)
    expect(Math.abs(sum(trend.map((p) => p.km)) - totalKm(data.exposure))).toBeLessThan(1e-3)
    expect(trend.at(-1)!.month).toBe('2026-05-01')
  })

  it('depot MDBF events add up to the fleet', () => {
    const rows = mdbfBy(data.events, data.exposure, 'breakdowns', 'depot')
    expect(rows).toHaveLength(10)
    expect(sum(rows.map((r) => r.failures))).toBe(expected.mdbf.breakdowns.events)
  })

  it('headline equals the golden MDBF', () => {
    expect(Math.round(headline(data.events, data.exposure, 'breakdowns').mdbf!)).toBe(expected.mdbf.breakdowns.mdbf_km)
  })

  it('finds the bad door control unit batch', () => {
    const rows = componentByBatch(data, 'Door control unit', ALL)
    expect(rows[0].batch).toBe('KIN-2024-04')
    expect(rows[0].per_100k_km).toBeGreaterThan(3 * rows[1].per_100k_km)
  })

  it('shows the campaign fixing the bad batch', () => {
    const q = batchVsRest(data, 'Door control unit', 'KIN-2024-04', ALL)
    const before = q.find((p) => p.quarter === '2025 Q1')!
    const after = q.find((p) => p.quarter === '2025 Q4')!
    expect(before.focus!).toBeGreaterThan(5 * before.rest!)
    expect(after.focus).toBe(0)
  })

  it('pareto ranks the traction battery pack first by cost', () => {
    expect(paretoRows(data, ALL, 'total_cost')[0].component).toBe('Traction battery pack')
  })

  it('what-if baseline equals the golden R&M cost per km, and no change saves nothing', () => {
    const r = whatIf(data, new Map(), DEFAULT_ASSUMPTIONS)
    expect(Math.abs(r.rmPerKm - expected.rm_cost.per_km_gbp)).toBeLessThan(0.00005)
    expect(r.savingPerBusYear).toBe(0)
  })

  it('doubling MDBF halves a component\'s cost', () => {
    const one = whatIf(data, new Map([['Traction battery pack', 100]]), DEFAULT_ASSUMPTIONS)
    const pack = paretoRows(data, ALL, 'total_cost')[0]
    const expectedSaving = (pack.total_cost / 2 / totalKm(data.exposure)) * DEFAULT_ASSUMPTIONS.kmPerYear
    expect(one.savingPerBusYear).toBeCloseTo(expectedSaving, 6)
  })
})
