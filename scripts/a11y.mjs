// Automated accessibility audit (axe-core) of every view, in a real browser.
// Catches missing labels, contrast, ARIA misuse and similar. It does not
// replace a manual screen-reader test.
//
//   npm run dev            (in another terminal)
//   npm run a11y           (or: node scripts/a11y.mjs http://localhost:4173)

import { createRequire } from 'node:module'
import { chromium } from 'playwright-core'

const require = createRequire(import.meta.url)
const axePath = require.resolve('axe-core/axe.min.js')
const base = process.argv[2] ?? 'http://localhost:5173'
const channel = process.env.BROWSER_CHANNEL ?? 'msedge' // or 'chrome'

const ready = (page) => page.waitForSelector('.stat-value, .state:not([role="status"]) , .state strong', { timeout: 20_000 })

/** Each scenario opens a view and puts it into a state worth checking. */
const scenarios = [
  { name: 'Fleet health', hash: 'fleet' },
  {
    name: 'Fleet health, tables open', hash: 'fleet',
    act: async (p) => {
      // Each click relabels that button "Show chart", so always click the first remaining one.
      const next = p.getByRole('button', { name: 'Show table' })
      while (await next.count()) await next.first().click()
    },
  },
  {
    name: 'Fleet health, empty filter', hash: 'fleet',
    act: async (p) => {
      await p.getByRole('radio', { name: 'Double-deck' }).check()
      await p.getByRole('combobox', { name: 'Depot' }).selectOption('Ashcombe')
      await p.getByText(/No double-deck buses at Ashcombe/).waitFor()
    },
  },
  { name: 'Component Pareto, drill-down', hash: 'components?c=Door%20control%20unit' },
  {
    name: 'Component Pareto, consumables + table', hash: 'components',
    act: async (p) => {
      await p.getByLabel('Show consumables').check()
      await p.getByRole('button', { name: 'Show table' }).first().click()
    },
  },
  { name: 'R&M what-if', hash: 'whatif' },
  {
    name: 'R&M what-if, invalid input', hash: 'whatif',
    act: async (p) => { await p.getByLabel('Labour rate').fill('') },
  },
]

const viewports = [
  { label: 'desktop', width: 1280, height: 900 },
  { label: 'phone', width: 400, height: 860 },
]

const browser = await chromium.launch({ channel })
let failures = 0
const seen = new Map()

for (const scheme of ['light', 'dark']) {
  for (const vp of viewports) {
    // bypassCSP: the deployed site's CSP (rightly) blocks injecting axe; this is test-only.
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, colorScheme: scheme, bypassCSP: true })
    for (const s of scenarios) {
      const page = await context.newPage()
      await page.goto(`${base}/#${s.hash}`)
      await ready(page)
      if (s.act) await s.act(page)
      await page.addScriptTag({ path: axePath })
      const result = await page.evaluate(() =>
        // eslint-disable-next-line no-undef
        axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] }))
      // Horizontal overflow is a responsive bug axe doesn't check.
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      const where = `${s.name} · ${vp.label} · ${scheme}`
      if (overflow > 1) {
        failures++
        console.log(`✗ ${where}: page scrolls sideways by ${overflow}px`)
      }
      for (const v of result.violations) {
        failures++
        const key = `${v.id}|${v.nodes.map((n) => n.target.join(' ')).join(',')}`
        if (seen.has(key)) { seen.get(key).push(where); continue }
        seen.set(key, [where])
        console.log(`\n✗ [${v.impact}] ${v.id}: ${v.help}  (${where})`)
        for (const n of v.nodes.slice(0, 4)) console.log(`    ${n.target.join(' ')}\n      ${n.failureSummary?.split('\n').slice(1, 3).join(' ').trim()}`)
        if (v.nodes.length > 4) console.log(`    …and ${v.nodes.length - 4} more`)
      }
      await page.close()
    }
    await context.close()
  }
}
await browser.close()

const checks = scenarios.length * viewports.length * 2
console.log(failures === 0
  ? `\n✓ No accessibility violations or sideways scrolling in ${checks} page states.`
  : `\n${failures} problem(s) across ${checks} page states (repeats of the same issue listed once).`)
process.exit(failures === 0 ? 0 : 1)
