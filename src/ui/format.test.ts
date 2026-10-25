import { describe, expect, it } from 'vitest'
import { fmt } from './format'

describe('counts and signs', () => {
  it('pluralises', () => {
    expect(fmt.count(1, 'failure')).toBe('1 failure')
    expect(fmt.count(55, 'failure')).toBe('55 failures')
    expect(fmt.count(26, 'bus', 'buses')).toBe('26 buses')
    expect(fmt.count(1, 'bus', 'buses')).toBe('1 bus')
  })
  it('signs percentages with a real minus', () => {
    expect(fmt.signedPct(-0.0612)).toBe('−6%')
    expect(fmt.signedPct(0.25)).toBe('+25%')
  })
})

describe('number wording', () => {
  it('writes distances in the short "m km" / "k km" style', () => {
    expect(fmt.distance(47_929_661)).toBe('47.9m km')
    expect(fmt.distance(855_000)).toBe('855k km')
    expect(fmt.distance(null)).toBe('–')
  })
  it('uses capital K and M for compact numbers', () => {
    expect(fmt.compact(80_000)).toBe('80K')
    expect(fmt.compact(47_900_000)).toBe('47.9M')
    expect(fmt.gbpCompact(747_200)).toBe('£747.2K')
    expect(fmt.gbpCompact(450_000)).toBe('£450K')
    expect(fmt.compact(500)).toBe('500')
  })
})

describe('fmt.title', () => {
  it.each([
    ['Door control unit', 'Door Control Unit'],
    ['Door open/close button', 'Door Open/Close Button'],
    ['24V auxiliary battery', '24V Auxiliary Battery'],
    ['Saloon CCTV camera', 'Saloon CCTV Camera'],
    ['Low-voltage electrical', 'Low-Voltage Electrical'],
    ['HV & traction', 'HV & Traction'],
    ['Unmapped operator code', 'Unmapped Operator Code'],
    ['Passenger info & CCTV', 'Passenger Info & CCTV'],
    ['Steering & suspension', 'Steering & Suspension'],
    ['Wheel trim of the bus', 'Wheel Trim of the Bus'],
  ])('%s -> %s', (input, output) => {
    expect(fmt.title(input)).toBe(output)
  })
})
