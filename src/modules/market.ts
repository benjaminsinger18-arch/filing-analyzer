import type { AnalysisModule, Metric, ModuleResult, Note, Unit } from './types'
import type { MarketRatios } from '@/lib/financials'

type Row = { id: string; label: string; unit: Unit; key: keyof MarketRatios; ours?: string }

const ROWS: Row[] = [
  { id: 'mkt-pe', label: 'P/E (provider, TTM)', unit: 'x', key: 'pe', ours: 'pe' },
  { id: 'mkt-forward-pe', label: 'Forward P/E', unit: 'x', key: 'forwardPe' },
  { id: 'mkt-peg', label: 'PEG', unit: 'x', key: 'peg' },
  { id: 'mkt-ev-ebitda', label: 'EV / EBITDA (provider)', unit: 'x', key: 'evEbitda', ours: 'ev-ebitda' },
  { id: 'mkt-ev-revenue', label: 'EV / revenue (provider)', unit: 'x', key: 'evRevenue', ours: 'ev-sales' },
  { id: 'mkt-pb', label: 'P/B (provider)', unit: 'x', key: 'pb', ours: 'pb' },
  { id: 'mkt-beta', label: 'Beta', unit: 'x', key: 'beta' },
  { id: 'mkt-dividend-yield', label: 'Dividend yield', unit: '%', key: 'dividendYield' },
  { id: 'mkt-cap', label: 'Market cap (provider)', unit: 'usd', key: 'marketCap' },
]

/** Provider-reported market ratios, each beside the ratio computed from the filing where one exists. */
export const market: AnalysisModule = {
  id: 'market',
  title: 'Market ratios (provider)',
  description: 'Provider-reported P/E, EV/EBITDA, P/B and more.',
  requires: [],
  run(fin, prior) {
    const m = fin.market
    if (!m) {
      return {
        id: 'market',
        title: 'Market ratios (provider)',
        metrics: [],
        notes: [{ tone: 'info', text: 'Click Fetch latest to load provider ratios.' }],
      }
    }
    const all = Object.values(prior).flatMap((r: ModuleResult) => r.metrics)
    const ours = (id: string) => all.find((x) => x.id === id)?.value ?? null
    const notes: Note[] = []
    if (m.ratiosNote) notes.push({ tone: 'info', text: m.ratiosNote })

    const metrics: Metric[] = []
    for (const row of ROWS) {
      const provider = m.ratios[row.key]
      if (provider === undefined) continue
      const computed = row.ours ? ours(row.ours) : null
      const inputs = [{ label: 'Provider', value: provider, tag: m.source }]
      if (computed !== null) inputs.push({ label: 'Computed from filing', value: computed, tag: 'this app' })
      metrics.push({
        id: row.id,
        label: row.label,
        unit: row.unit,
        value: provider,
        formula: computed !== null ? `Filing-based: ${computed.toFixed(2)}x` : 'Provider-reported',
        inputs,
      })
      if (computed !== null && computed > 0 && Math.abs(provider / computed - 1) > 0.25) {
        notes.push({
          tone: 'info',
          text: `${row.label}: provider ${provider.toFixed(1)}x vs ${computed.toFixed(1)}x from the filing. Providers use trailing-twelve-month figures and their own share counts; this app uses the filing period${fin.basis === 'quarter' ? ' (quarter x4)' : ''}.`,
        })
      }
    }
    return { id: 'market', title: 'Market ratios (provider)', metrics, notes }
  },
}
