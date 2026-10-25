// Small inline icons (24px grid, stroke = currentColor). Decorative: always aria-hidden.
// Shapes adapted from Lucide (ISC licence).

const base = {
  viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2,
  strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
} as const

export function BusIcon() {
  return (
    <svg {...base}>
      <path d="M8 6v6" /><path d="M15 6v6" /><path d="M2 12h19.6" />
      <path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3" />
      <circle cx="7" cy="18" r="2" /><path d="M9 18h5" /><circle cx="16" cy="18" r="2" />
    </svg>
  )
}

export function InfoIcon() {
  return (
    <svg {...base}>
      <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
    </svg>
  )
}

export function SunIcon() {
  return (
    <svg {...base}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  )
}

export function MoonIcon() {
  return (
    <svg {...base}>
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  )
}

export function MonitorIcon() {
  return (
    <svg {...base}>
      <rect width="20" height="14" x="2" y="3" rx="2" /><path d="M8 21h8" /><path d="M12 17v4" />
    </svg>
  )
}

export function SearchChartIcon() {
  return (
    <svg {...base}>
      <path d="M3 3v16a2 2 0 0 0 2 2h16" /><path d="M7 16l4-4 3 3 5-6" />
    </svg>
  )
}
