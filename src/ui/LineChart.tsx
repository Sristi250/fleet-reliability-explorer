import * as m from 'motion/react-m'
import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'

export interface LineSeries {
  id: string
  label: string
  /** A CSS colour, normally a var(--series-n). */
  color: string
  values: (number | null)[]
}

/** Round axis maximum and step: 1, 2, 2.5 or 5 times a power of ten. */
function niceScale(max: number, ticks = 4): { max: number; step: number } {
  if (!(max > 0)) return { max: 1, step: 0.25 }
  const raw = max / ticks
  const pow = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw)!
  return { max: Math.ceil(max / step) * step, step }
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(640)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, entry.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

const M = { top: 12, right: 16, bottom: 28, left: 56 }

export function LineChart({
  labels, series, formatY, formatX, formatTooltipX, height = 260, ariaLabel, yLabel,
}: {
  labels: string[]
  series: LineSeries[]
  formatY: (n: number) => string
  formatX: (label: string) => string
  formatTooltipX?: (label: string) => string
  height?: number
  ariaLabel: string
  yLabel?: string
}) {
  const [wrapRef, width] = useWidth<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)

  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null))
  const { max, step } = niceScale(Math.max(0, ...all))
  const innerW = width - M.left - M.right
  const innerH = height - M.top - M.bottom
  const n = labels.length
  const x = (i: number) => M.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW)
  const y = (v: number) => M.top + innerH - (v / max) * innerH

  const ticks: number[] = []
  for (let t = 0; t <= max + step / 2; t += step) ticks.push(t)
  const xEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(innerW / 70))))

  const path = (values: (number | null)[]) => {
    let d = ''
    let pen = false
    values.forEach((v, i) => {
      if (v === null) { pen = false; return }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`
      pen = true
    })
    return d
  }

  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * innerW
    setActive(Math.min(n - 1, Math.max(0, Math.round((px / innerW) * (n - 1)))))
  }
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    const move = { ArrowLeft: -1, ArrowRight: 1, Home: -n, End: n }[e.key]
    if (move === undefined) return
    e.preventDefault()
    setActive((a) => Math.min(n - 1, Math.max(0, (a ?? n - 1) + move)))
  }

  const tipLeft = active !== null ? x(active) : 0
  const tipOnLeft = tipLeft > width * 0.6

  return (
    <div className="chart" ref={wrapRef}>
      {series.length > 1 && (
        <ul className="legend" aria-label="Legend">
          {series.map((s) => (
            <li key={s.id}><span className="key-line" style={{ background: s.color }} />{s.label}</li>
          ))}
        </ul>
      )}
      <div className="chart-plot">
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`${ariaLabel}. Use the left and right arrow keys to read values.`}
          tabIndex={0}
          onKeyDown={onKey}
          onFocus={() => setActive((a) => a ?? n - 1)}
          onBlur={() => setActive(null)}
        >
          {yLabel && <text className="axis-title" x={M.left} y={M.top - 2}>{yLabel}</text>}
          {ticks.map((t) => (
            <g key={t}>
              <line className={t === 0 ? 'baseline' : 'grid'} x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} />
              <text className="tick" x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end">{formatY(t)}</text>
            </g>
          ))}
          {labels.map((l, i) => (i % xEvery === 0 || i === n - 1) && (n - 1 - i >= xEvery || i === n - 1) ? (
            <text key={l} className="tick" x={x(i)} y={height - 8} textAnchor="middle">{formatX(l)}</text>
          ) : null)}
          {active !== null && <line className="crosshair" x1={x(active)} x2={x(active)} y1={M.top} y2={M.top + innerH} />}
          {series.map((s) => (
            // Draws in once on mount; later data changes just swap the path.
            <m.path
              key={s.id}
              d={path(s.values)}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            />
          ))}
          {series.map((s) => {
            const i = active ?? lastIndex(s.values)
            const v = i === null ? null : s.values[i]
            return v === null || v === undefined || i === null ? null : (
              <circle key={s.id} className="dot" cx={x(i)} cy={y(v)} r={4.5} fill={s.color} />
            )
          })}
          <rect
            x={M.left} y={M.top} width={innerW} height={innerH} fill="transparent"
            onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setActive(null)}
          />
        </svg>
        {active !== null && (
          <div
            className="tooltip"
            role="status"
            style={{ left: tipLeft, top: M.top, transform: tipOnLeft ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)' }}
          >
            <div className="tooltip-title">{(formatTooltipX ?? formatX)(labels[active])}</div>
            {series.map((s) => (
              <div key={s.id} className="tooltip-row">
                <span className="key-line" style={{ background: s.color }} />
                <span>{s.label}</span>
                <strong>{s.values[active] === null ? '–' : formatY(s.values[active]!)}</strong>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function lastIndex(values: (number | null)[]): number | null {
  for (let i = values.length - 1; i >= 0; i--) if (values[i] !== null) return i
  return null
}
