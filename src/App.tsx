import { useEffect, useMemo, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { buildFleetData, type FleetData } from './data/clean'
import { csvSource } from './data/source'
import { ALL, type Slice } from './data/views'
import { AnimatePresence } from 'motion/react'
import * as m from 'motion/react-m'
import { BusIcon } from './ui/icons'
import { ViewSkeleton } from './ui/Skeleton'
import { ThemeToggle } from './ui/ThemeToggle'
import type { DepotInfo } from './ui/SliceFilters'
import { ComponentPareto } from './views/ComponentPareto'
import { FleetHealth } from './views/FleetHealth'
import { RmWhatIf } from './views/RmWhatIf'

const TABS = [
  {
    id: 'fleet',
    label: 'Fleet Health',
    question: 'Is Reliability Improving?',
    description: 'Mean distance between failures (MDBF) across the fleet, by model and by depot.',
  },
  {
    id: 'components',
    label: 'Component Pareto',
    question: 'Which Components Cost Us Most?',
    description: 'Components ranked by failures or cost. Select one to see which delivery batches drive it.',
  },
  {
    id: 'whatif',
    label: 'R&M What-If',
    question: 'What Is Better Reliability Worth?',
    description: 'Make chosen components more reliable and see what it saves in repair and maintenance (R&M).',
  },
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
    <>
      <a className="skip" href="#main" onClick={skipToMain}>Skip to Content</a>
      <header className="app-header">
        <div className="container header-inner">
          <div className="brand">
            <span className="logo"><BusIcon /></span>
            <div>
              <div className="brand-title">
                <h1>Fleet Reliability Explorer</h1>
                <span className="badge">Synthetic Data</span>
              </div>
              <p className="brand-sub">Kestrel Bus Group · Battery-Electric Fleet</p>
            </div>
          </div>
          <nav aria-label="Main">
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
                  {tab === t.id && <m.span layoutId="tab-pill" className="tab-pill" transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }} />}
                  <span className="tab-text">{t.label}</span>
                </button>
              ))}
            </div>
          </nav>
          <ThemeToggle />
        </div>
      </header>

      <main id="main" className="container" tabIndex={-1}>
        <div id="panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
          <AnimatePresence mode="wait" initial={false}>
          <m.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
          <div className="view-head">
            <h2 className="view-title">{current.question}</h2>
            <p className="view-desc">{current.description}</p>
          </div>
          {state.status === 'loading' && <ViewSkeleton kind={tab} />}
          {state.status === 'error' && (
            <div className="state state-error" role="alert">
              <strong>Couldn't Load the Fleet Data</strong>
              <span>{state.message}</span>
              <button type="button" className="btn-ghost" onClick={() => window.location.reload()}>Try Again</button>
            </div>
          )}
          {state.status === 'ready' && (
            <>
              {tab === 'fleet' && <FleetHealth data={state.data} slice={slice} setSlice={setSlice} depots={depots} />}
              {tab === 'components' && <ComponentPareto data={state.data} slice={slice} setSlice={setSlice} depots={depots} />}
              {tab === 'whatif' && <RmWhatIf data={state.data} />}
            </>
          )}
          </m.div>
          </AnimatePresence>
        </div>
      </main>

      <footer className="container app-footer">
        <div>
          All data is synthetic, generated to resemble a UK battery-electric bus fleet. No real operator,
          manufacturer, vehicle or price appears. Analysis window: from each depot joining the maintenance
          system (EAM) to 31 May 2026.
        </div>
      </footer>
    </>
  )
}
