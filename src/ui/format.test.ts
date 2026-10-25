import { describe, expect, it } from 'vitest'
import { fmt } from './format'

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
