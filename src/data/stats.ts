/** Sum with compensated (Kahan) addition, so long sums of km don't drift. */
export function sum(values: number[]): number {
  let total = 0
  let carry = 0
  for (const v of values) {
    const y = v - carry
    const t = total + y
    carry = t - total - y
    total = t
  }
  return total
}

/** Median, averaging the middle two for an even count. Null for an empty list. */
export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}
