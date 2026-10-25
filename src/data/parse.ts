import Papa from 'papaparse'
import type {
  Bus, Depot, Model, OdometerReading, OperatorPartXref, Part, RawTables,
  WarrantyClaimLine, WorkshopLine,
} from './types'

export const TABLE_FILES = {
  depots: 'depots.csv',
  buses: 'buses.csv',
  odometer: 'odometer_monthly.csv',
  parts: 'parts.csv',
  xref: 'operator_part_xref.csv',
  workshop: 'workshop_lines.csv',
  warranty: 'warranty_claim_lines.csv',
} as const satisfies Record<keyof RawTables, string>

export type CsvTexts = Record<keyof RawTables, string>

type Row = Record<string, string>

function rows(text: string): Row[] {
  const result = Papa.parse<Row>(text, { header: true, skipEmptyLines: true })
  if (result.errors.length) {
    const e = result.errors[0]
    throw new Error(`CSV parse error on row ${e.row}: ${e.message}`)
  }
  return result.data
}

function num(value: string, column: string): number {
  const n = Number(value)
  if (value.trim() === '' || Number.isNaN(n)) throw new Error(`${column}: not a number: "${value}"`)
  return n
}

function optionalNum(value: string, column: string): number | null {
  return value.trim() === '' ? null : num(value, column)
}

function model(value: string): Model {
  if (value !== 'DD' && value !== 'SD') throw new Error(`Unknown model "${value}"`)
  return value
}

/** Turns the CSV files into typed tables. Throws on malformed values. */
export function parseTables(csv: CsvTexts): RawTables {
  return {
    depots: rows(csv.depots) as unknown as Depot[],
    buses: rows(csv.buses).map((r): Bus => ({ ...(r as unknown as Bus), model: model(r.model) })),
    odometer: rows(csv.odometer).map((r): OdometerReading => ({
      body_number: r.body_number,
      reading_date: r.reading_date,
      odometer_km: num(r.odometer_km, 'odometer_km'),
    })),
    parts: rows(csv.parts).map((r): Part => ({
      part_number: r.part_number,
      component: r.component,
      system: r.system,
      is_consumable: r.is_consumable === 'True',
      unit: r.unit,
      models: r.models.split('|').map(model),
      superseded_by: r.superseded_by,
      description: r.description,
      list_price_gbp: num(r.list_price_gbp, 'list_price_gbp'),
    })),
    xref: rows(csv.xref) as unknown as OperatorPartXref[],
    workshop: rows(csv.workshop).map((r): WorkshopLine => ({
      ...(r as unknown as WorkshopLine),
      qty: num(r.qty, 'qty'),
      wo_total_hours: optionalNum(r.wo_total_hours, 'wo_total_hours'),
    })),
    warranty: rows(csv.warranty).map((r): WarrantyClaimLine => ({
      ...(r as unknown as WarrantyClaimLine),
      qty: num(r.qty, 'qty'),
      part_cost_gbp: num(r.part_cost_gbp, 'part_cost_gbp'),
    })),
  }
}
