import * as m from 'motion/react-m'
import { useEffect, useState, type JSX } from 'react'
import { MonitorIcon, MoonIcon, SunIcon } from './icons'

type Theme = 'light' | 'system' | 'dark'

const OPTIONS: { value: Theme; label: string; Icon: () => JSX.Element }[] = [
  { value: 'light', label: 'Light Theme', Icon: SunIcon },
  { value: 'system', label: 'System Theme', Icon: MonitorIcon },
  { value: 'dark', label: 'Dark Theme', Icon: MoonIcon },
]

function readTheme(): Theme {
  try {
    const t = localStorage.getItem('theme')
    return t === 'light' || t === 'dark' ? t : 'system'
  } catch {
    return 'system'
  }
}

/** Light / System / Dark. public/theme-init.js applies the saved choice before first paint. */
export function ThemeToggle() {
  const [theme, choose] = useState<Theme>(readTheme)

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)
    try {
      if (theme === 'system') localStorage.removeItem('theme')
      else localStorage.setItem('theme', theme)
    } catch { /* storage blocked: the choice lasts for this visit only */ }
  }, [theme])

  return (
    <div className="theme-toggle" role="group" aria-label="Colour Theme">
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          aria-pressed={theme === value}
          aria-label={label}
          title={label}
          className="theme-option"
          onClick={() => choose(value)}
        >
          {theme === value && <m.span layoutId="theme-pill" className="theme-pill" transition={{ type: 'spring', bounce: 0.15, duration: 0.35 }} />}
          <Icon />
        </button>
      ))}
    </div>
  )
}
