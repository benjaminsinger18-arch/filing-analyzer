import type { AnalysisModule, ModuleResult, Note } from './types'

const pct = (v: number) => `${(v * 100).toFixed(1)}%`

/** Templated, rule-triggered observations. Wording is hedged: these are flags to look into, not conclusions. */
export const notes: AnalysisModule = {
  id: 'notes',
  title: 'Observations',
  description: 'Rule-triggered flags.',
  requires: [],
  run(fin, prior) {
    const m = (id: string) =>
      Object.values(prior)
        .flatMap((r: ModuleResult) => r.metrics)
        .find((x) => x.id === id)?.value ?? null
    const out: Note[] = []
    const add = (tone: Note['tone'], text: string) => out.push({ tone, text })

    const om = m('operating-margin')
    if (om !== null) {
      if (om < 0) add('watch', `Operating loss: margin ${pct(om)}.`)
      else if (om >= 0.2) add('good', `Operating margin ${pct(om)}.`)
    }
    const rg = m('rev-growth')
    if (rg !== null) {
      if (rg < 0) add('watch', `Revenue down ${pct(Math.abs(rg))} vs. the comparison period.`)
      else if (rg >= 0.15) add('good', `Revenue up ${pct(rg)}.`)
    }
    const gm = m('gross-margin')
    const oi = m('oi-growth')
    if (rg !== null && oi !== null && rg > 0 && oi < 0) {
      add('watch', 'Operating income fell while revenue grew.')
    }
    if (gm !== null && gm < 0.2) add('info', `Gross margin ${pct(gm)}, under 20%.`)

    const cr = m('current-ratio')
    if (cr !== null && cr < 1) add('watch', `Current ratio ${cr.toFixed(2)}: current liabilities exceed current assets.`)
    const ic = m('interest-coverage')
    if (ic !== null && ic < 2) add('watch', `Interest coverage ${ic.toFixed(1)}x, under 2x.`)
    const lev = m('liabilities-assets')
    if (lev !== null && lev > 0.8) add('watch', `Liabilities are ${pct(lev)} of assets.`)
    const de = m('debt-ebitda')
    if (de !== null && de > 4) add('watch', `Debt is ${de.toFixed(1)}x EBITDA, over 4x.`)

    const oc = m('ocf-ni')
    if (oc !== null && oc < 0.8) add('watch', `Operating cash flow is ${oc.toFixed(2)}x net income, under 0.8x.`)
    else if (oc !== null && oc > 1.2) add('good', `Operating cash flow is ${oc.toFixed(2)}x net income.`)
    const fm = m('fcf-margin')
    if (fm !== null && fm < 0) add('watch', `Free cash flow is negative (${pct(fm)} of revenue).`)

    const dso = m('dso')
    if (dso !== null && dso > 90) add('info', `Receivables take about ${Math.round(dso)} days to collect.`)

    return { id: 'notes', title: 'Observations', metrics: [], notes: out }
  },
}
