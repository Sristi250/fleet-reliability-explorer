// Analysis rules. These mirror the constants in data-gen/reference_metrics.py;
// change them in both places or the golden-number tests will fail.

/** Last day counted. June repairs were still being claimed when the data was extracted. */
export const WINDOW_END = '2026-05-31'

/** A month above this is a bad odometer reading: no bus runs this far. */
export const MAX_KM_PER_MONTH = 15_000

/** Default labour rate. Editable in the what-if view. */
export const LABOUR_RATE_GBP = 45

export const UNMAPPED = 'Unmapped operator code'

export const CORRECTIVE_TYPES = ['Breakdown', 'Driver Defect', 'Work Arising'] as const
export type CorrectiveType = (typeof CORRECTIVE_TYPES)[number]
export type FailureType = CorrectiveType | 'Unclassified'

/** People mean different things by "failure", so MDBF has three definitions. */
export const FAILURE_DEFINITIONS = {
  breakdowns: ['Breakdown'],
  breakdowns_and_driver_defects: ['Breakdown', 'Driver Defect'],
  all_corrective: [...CORRECTIVE_TYPES],
} as const satisfies Record<string, readonly FailureType[]>
export type FailureDefinition = keyof typeof FAILURE_DEFINITIONS

export const FAILURE_DEFINITION_LABELS: Record<FailureDefinition, string> = {
  breakdowns: 'In-service breakdowns',
  breakdowns_and_driver_defects: 'Breakdowns + driver defects',
  all_corrective: 'All corrective repairs',
}

/** Warranty claims have no work-order type; it only exists in the complaint text. */
export const COMPLAINT_TYPE: [RegExp, CorrectiveType][] = [
  [/failed in service|recovered to depot/i, 'Breakdown'],
  [/driver reported/i, 'Driver Defect'],
  [/inspection/i, 'Work Arising'],
]
