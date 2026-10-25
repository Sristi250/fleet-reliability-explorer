import { useEffect, useMemo, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { buildFleetData, type FleetData } from './data/clean'
import { csvSource } from './data/source'
import { ALL, type Slice } from './data/views'
import { ComponentPareto } from './views/ComponentPareto'
import { FleetHealth } from './views/FleetHealth'
import { RmWhatIf } from './views/RmWhatIf'
import type { DepotInfo } from './ui/SliceFilters'

const TABS = [
  { id: 'fleet', label: 'Fleet health', question: 'Is reliability improving?' },
  { id: 'components', label: 'Component Pareto', question: 'Which components cost us most?' },
  { id: 'whatif', label: 'R&M what-if', question: 'What is better reliability worth?' },
] as const
type TabId = (typeof TABS)[number]['id']

function tabFromHash(): TabId {
  const h = window.location.hash.slice(1).split('?')[0]
  return TABS.some((t) => t.id === h) ? (h as TabId) : 'fleet'
}

type State = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: FleetData }

export default function App() {
  const [state, setState] = useState<State>({ status: 'loading' })
  const [tab, setTab] = useState<TabId>(tabFromHash)
  // The model/depot slice is shared, so it carries across tabs.
  const [slice, setSlice] = useState<Slice>(ALL)

  useEffect(() => {
    let cancelled = false
    csvSource().load()
      .then((raw) => { if (!cancelled) setState({ status: 'ready', data: buildFleetData(raw) }) })
      .catch((e: unknown) => { if (!cancelled) setState({ status: 'error', message: e instanceof Error ? e.message : String(e) }) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const onHash = () => setTab(tabFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const select = (id: TabId) => {
    setTab(id)
    history.replaceState(null, '', `#${id}`)
  }
  const onTabKey = (e: KeyboardEvent) => {
    const i = TABS.findIndex((t) => t.id === tab)
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: TABS.length - 1 }[e.key]
    if (next === undefined) return
    e.preventDefault()
    const t = TABS[(next + TABS.length) % TABS.length]
    select(t.id)
    document.getElementById(`tab-${t.id}`)?.focus()
  }

  const depots = useMemo((): DepotInfo[] => {
    if (state.status !== 'ready') return []
    const { buses, depots } = state.data.raw
    return depots.map((d) => d.depot).sort().map((name) => ({
      name,
      models: [...new Set(buses.filter((b) => b.depot === name).map((b) => b.model))],
    }))
  }, [state])
  const current = TABS.find((t) => t.id === tab)!

  useEffect(() => {
    document.title = `${current.label} · Fleet Reliability Explorer`
  }, [current])

  // A plain #main link would change the hash, which is how tabs are routed.
  const skipToMain = (e: MouseEvent) => {
    e.preventDefault()
    document.getElementById('main')?.focus()
  }

  return (
    <div className="app">
      <a className="skip" href="#main" onClick={skipToMain}>Skip to content</a>
      <header className="app-header">
        <div className="brand">
          <h1>Fleet Reliability Explorer</h1>
          <p>Kestrel Bus Group · battery-electric fleet · <span className="badge">Synthetic data</span></p>
        </div>
        <nav>
          <div role="tablist" aria-label="Views" className="tabs" onKeyDown={onTabKey}>
            {TABS.map((t) => (
              <button
                key={t.id}
                id={`tab-${t.id}`}
                role="tab"
                type="button"
                aria-selected={tab === t.id}
                aria-controls="panel"
                tabIndex={tab === t.id ? 0 : -1}
                className="tab"
                onClick={() => select(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </nav>
      </header>

      <main id="main" tabIndex={-1}>
        <div id="panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        <p className="question">{current.question}</p>
        {state.status === 'loading' && (
          <div className="state" role="status">
            <div className="spinner" aria-hidden="true" />
            Loading and cleaning about 40,000 rows…
          </div>
        )}
        {state.status === 'error' && (
          <div className="state state-error" role="alert">
            <strong>Couldn't load the fleet data.</strong>
            <span>{state.message}</span>
            <button type="button" className="btn-ghost" onClick={() => window.location.reload()}>Try again</button>
          </div>
        )}
        {state.status === 'ready' && (
          <>
            {tab === 'fleet' && <FleetHealth data={state.data} slice={slice} setSlice={setSlice} depots={depots} />}
            {tab === 'components' && <ComponentPareto data={state.data} slice={slice} setSlice={setSlice} depots={depots} />}
            {tab === 'whatif' && <RmWhatIf data={state.data} />}
          </>
        )}
        </div>
      </main>

      <footer className="app-footer">
        All data is synthetic, generated to resemble a UK battery-electric bus fleet. No real operator,
        manufacturer, vehicle or price appears. Analysis window: each depot's EAM go-live to 31 May 2026.
      </footer>
    </div>
  )
}
