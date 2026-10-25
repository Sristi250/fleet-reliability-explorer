const int = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 })
const compact = new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 })
const gbp0 = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 })
const gbp2 = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const gbp3 = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 3, maximumFractionDigits: 3 })
const gbpCompact = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', notation: 'compact', maximumFractionDigits: 1 })
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const fmt = {
  int: (n: number) => int.format(n),
  compact: (n: number) => compact.format(n),
  km: (n: number | null) => (n === null ? '–' : `${int.format(n)} km`),
  gbp: (n: number) => gbp0.format(n),
  gbp2: (n: number) => gbp2.format(n),
  gbp3: (n: number) => gbp3.format(n),
  gbpCompact: (n: number) => gbpCompact.format(n),
  pct: (n: number, dp = 0) => `${(n * 100).toFixed(dp)}%`,
  num: (n: number, dp = 1) => n.toFixed(dp),
  /** 2025-03-01 -> Mar 2025 */
  month: (iso: string) => `${months[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`,
  /** 2025-03-01 -> Mar 25 */
  monthShort: (iso: string) => `${months[Number(iso.slice(5, 7)) - 1]} ${iso.slice(2, 4)}`,
}
