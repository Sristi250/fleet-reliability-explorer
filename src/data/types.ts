// Raw rows, one interface per CSV in public/data. Dates are ISO strings
// (YYYY-MM-DD) so they compare correctly as strings.

export type Model = 'DD' | 'SD'

export interface Depot {
  plant_code: string
  depot: string
  operating_company: string
  eam_go_live: string
}

export interface Bus {
  body_number: string
  fleet_number: string
  model: Model
  operating_company: string
  depot: string
  batch: string
  delivery_date: string
  in_service_date: string
}

export interface OdometerReading {
  body_number: string
  reading_date: string
  odometer_km: number
}

export interface Part {
  part_number: string
  component: string
  system: string
  is_consumable: boolean
  unit: string
  /** Models the part is fitted to. */
  models: Model[]
  superseded_by: string
  description: string
  list_price_gbp: number
}

export interface OperatorPartXref {
  operator_part_code: string
  operator_description: string
  /** Blank when the operator code has not been mapped. */
  part_number: string
}

export interface WorkshopLine {
  wo_ref: string
  wo_date: string
  plant_code: string
  fleet_number: string
  wo_type: string
  wo_description: string
  operator_part_code: string
  operator_part_description: string
  /** Negative = part returned to stores. */
  qty: number
  /** Repeated on every line of the work order. Blank on some work orders. */
  wo_total_hours: number | null
}

export interface WarrantyClaimLine {
  claim_ref: string
  claim_date: string
  repair_date: string
  body_number: string
  /** Typed by hand and often copied from the previous claim. Don't join on it. */
  customer_fleet_ref: string
  complaint: string
  part_number: string
  part_description: string
  qty: number
  part_cost_gbp: number
}

export interface RawTables {
  depots: Depot[]
  buses: Bus[]
  odometer: OdometerReading[]
  parts: Part[]
  xref: OperatorPartXref[]
  workshop: WorkshopLine[]
  warranty: WarrantyClaimLine[]
}
