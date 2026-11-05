import type { AnalysisModule, ModuleResult, Note } from './types'

const pct = (v: number) => `${(v * 100).toFixed(1)}%`

/** Templated, rule-triggered observations. Wording is hedged: these are flags to look into, not conclusions. */
export const notes: AnalysisModule = {
  id: 'notes',
  title: 'Observations',
  description: 'Rule-triggered flags drawn from the other modules.',
  requires: [],
  run(_fin, prior) {
    const m = (id: string) =>
      Object.values(prior)
        .flatMap((r: ModuleResult) => r.metrics)
        .find((x) => x.id === id)?.value ?? null
    const out: Note[] = []
    const add = (tone: Note['tone'], text: string) => out.push({ tone, text })

    const om = m('operating-margin')
    if (om !== null) {
      if (om < 0) add('watch', `Operating margin is ${pct(om)}: the company reported an operating loss in this period.`)
      else if (om >= 0.2) add('good', `Operating margin of ${pct(om)} is high; this could reflect pricing power or a capital-light model.`)
    }
    const rg = m('rev-growth')
    if (rg !== null) {
      if (rg < 0) add('watch', `Revenue fell ${pct(Math.abs(rg))} versus the comparison period.`)
      else if (rg >= 0.15) add('good', `Revenue grew ${pct(rg)}, well above a typical mature-company pace.`)
    }
    const gm = m('gross-margin')
    const oi = m('oi-growth')
    if (rg !== null && oi !== null && rg > 0 && oi < 0) {
      add('watch', 'Operating income fell while revenue grew, which is consistent with rising costs or investment outrunning sales.')
    }
    if (gm !== null && gm < 0.2) add('info', `Gross margin of ${pct(gm)} is thin; small cost changes could move profit materially.`)

    const cr = m('current-ratio')
    if (cr !== null && cr < 1) add('watch', `Current ratio is ${cr.toFixed(2)}: current liabilities exceed current assets, which may matter for near-term funding.`)
    const ic = m('interest-coverage')
    if (ic !== null && ic < 2) add('watch', `Interest coverage of ${ic.toFixed(1)}x leaves a thin cushion if earnings fall.`)
    const lev = m('liabilities-assets')
    if (lev !== null && lev > 0.8) add('watch', `Liabilities are ${pct(lev)} of assets; high balance-sheet leverage.`)
    const de = m('debt-ebitda')
    if (de !== null && de > 4) add('watch', `Debt is ${de.toFixed(1)}x EBITDA, above a level many lenders treat as elevated.`)

    const oc = m('ocf-ni')
    if (oc !== null && oc < 0.8) add('watch', `Operating cash flow is only ${oc.toFixed(2)}x net income; earnings may not be fully backed by cash.`)
    else if (oc !== null && oc > 1.2) add('good', `Operating cash flow is ${oc.toFixed(2)}x net income, a sign of cash-backed earnings.`)
    const fm = m('fcf-margin')
    if (fm !== null && fm < 0) add('watch', `Free cash flow is negative (${pct(fm)} of revenue).`)

    const dso = m('dso')
    if (dso !== null && dso > 90) add('info', `Receivables take about ${Math.round(dso)} days to collect.`)

    if (out.length === 0) add('info', 'No rule-based flags were triggered from the data available in this filing.')
    return { id: 'notes', title: 'Observations', metrics: [], notes: out }
  },
}
