import { useId, useState, type ReactNode } from 'react'

interface Option<T extends string> {
  value: T
  label: string
}

/** A segmented control built on native radios, so keyboard and screen readers work for free. */
export function Segmented<T extends string>({
  label, value, options, onChange,
}: { label: string; value: T; options: Option<T>[]; onChange: (v: T) => void }) {
  const name = useId()
  return (
    <fieldset className="control">
      <legend className="control-label">{label}</legend>
      <div className="segmented">
        {options.map((o) => (
          <label key={o.value} className="segment">
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
            />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export function Select<T extends string>({
  label, value, options, onChange,
}: { label: string; value: T; options: Option<T>[]; onChange: (v: T) => void }) {
  const id = useId()
  return (
    <div className="control">
      <label className="control-label" htmlFor={id}>{label}</label>
      <select id={id} className="select" value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

export function NumberField({
  label, unit, value, onChange, step = 1, min = 0,
}: { label: string; unit?: string; value: number; onChange: (v: number) => void; step?: number; min?: number }) {
  const id = useId()
  // Keep the typed text separately, so the field can be cleared or half-typed
  // without snapping to 0. Only valid numbers reach the calculation.
  const [text, setText] = useState(String(value))
  const [lastValue, setLastValue] = useState(value)
  if (value !== lastValue) {
    // Changed from outside (e.g. "Reset assumptions").
    setLastValue(value)
    setText(String(value))
  }
  const parsed = Number(text)
  const invalid = text.trim() === '' || !Number.isFinite(parsed) || parsed < min
  return (
    <div className="number-field">
      <label htmlFor={id}>{label}</label>
      <div className={invalid ? 'number-input is-invalid' : 'number-input'}>
        <input
          id={id}
          type="number"
          inputMode="decimal"
          value={text}
          step={step}
          min={min}
          aria-invalid={invalid}
          aria-describedby={invalid ? `${id}-err` : undefined}
          onChange={(e) => {
            setText(e.target.value)
            const v = Number(e.target.value)
            if (e.target.value.trim() !== '' && Number.isFinite(v) && v >= min) {
              setLastValue(v)
              onChange(v)
            }
          }}
        />
        {unit && <span className="unit">{unit}</span>}
      </div>
      {invalid && <div id={`${id}-err`} className="field-error">Enter a number{min === 0 ? ' of 0 or more' : ''}.</div>}
    </div>
  )
}

export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="filter-bar" role="group" aria-label="Filters">{children}</div>
}

export interface StatProps {
  label: string
  value: string
  sub?: ReactNode
  hero?: boolean
}

export function Stat({ label, value, sub, hero }: StatProps) {
  return (
    <div className={hero ? 'stat stat-hero' : 'stat'}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

/** A signed change, coloured by whether it is good, with an arrow so colour isn't the only cue. */
export function Delta({ change, goodWhenUp, text }: { change: number; goodWhenUp: boolean; text: string }) {
  if (Math.abs(change) < 0.005) return <span className="delta">→ {text}</span>
  const good = change > 0 === goodWhenUp
  return (
    <span className={good ? 'delta delta-good' : 'delta delta-bad'}>
      {change > 0 ? '▲' : '▼'} {text}
    </span>
  )
}
