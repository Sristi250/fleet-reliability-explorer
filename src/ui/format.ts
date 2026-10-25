const int = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 })
const compact = new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 })
const gbp0 = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 })
const gbp2 = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const gbp3 = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 3, maximumFractionDigits: 3 })
const gbpCompact = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', notation: 'compact', maximumFractionDigits: 1 })
// Words kept lower case inside a title (but not as the first word).
const SMALL_WORDS = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'vs', 'via', 'with'])

/**
 * Title Case for display only: "Door open/close button" -> "Door Open/Close Button".
 * Words that already contain capitals or digits (24V, HV, CCTV, KIN-2024-04) are left alone.
 */
function titleCase(text: string): string {
  return text.replace(/[A-Za-z0-9][\w'’]*/g, (word, offset: number) => {
    if (/[A-Z0-9]/.test(word.slice(1)) || /^[0-9]/.test(word)) return word
    const prev = text[offset - 1]
    if (offset > 0 && prev === ' ' && SMALL_WORDS.has(word.toLowerCase())) return word.toLowerCase()
    return word[0].toUpperCase() + word.slice(1)
  })
}

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** en-GB writes compact numbers as "48k" / "47.9m"; use capitals (48K, 47.9M) so "m" can't be misread as metres. */
const upperSuffix = (s: string) => s.replace(/([0-9])\s?([kmbt])$/i, (_, d: string, unit: string) => d + unit.toUpperCase())

export const fmt = {
  int: (n: number) => int.format(n),
  /** 80000 -> 80K (axis ticks). */
  compact: (n: number) => upperSuffix(compact.format(n)),
  km: (n: number | null) => (n === null ? '–' : `${int.format(n)} km`),
  /** Short distance: 47,929,661 -> "47.9m km", 855,000 -> "855k km" (the owner's preferred style). */
  distance: (n: number | null) => (n === null ? '–' : `${compact.format(n)} km`),
  gbp: (n: number) => gbp0.format(n),
  gbp2: (n: number) => gbp2.format(n),
  gbp3: (n: number) => gbp3.format(n),
  /** 747200 -> £747.2K */
  gbpCompact: (n: number) => upperSuffix(gbpCompact.format(n)),
  pct: (n: number, dp = 0) => `${(n * 100).toFixed(dp)}%`,
  title: titleCase,
  num: (n: number, dp = 1) => n.toFixed(dp),
  /** 2025-03-01 -> Mar 2025 */
  month: (iso: string) => `${months[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`,
  /** 2025-03-01 -> Mar 25 */
  monthShort: (iso: string) => `${months[Number(iso.slice(5, 7)) - 1]} ${iso.slice(2, 4)}`,
}
