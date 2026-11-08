import type { AnalysisModule, ModuleResult, Note } from './types'

const pct = (v: number) => `${(v * 100).toFixed(1)}%`
const MAX_NOTES = 6
const ORDER: Record<Note['tone'], number> = { watch: 0, good: 1, info: 2 }

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
      if (om < 0) add('watch', `Lost money on operations: operating margin ${pct(om)}.`)
      else if (om >= 0.2) add('good', `Strong operating margin of ${pct(om)}.`)
    }
    // Margin change against the comparison period, from the filing's own prior-year figures.
    const oiNow = fin.cur.operatingIncome?.value
    const revNow = fin.cur.revenue?.value
    const oiThen = fin.prior.operatingIncome?.value
    const revThen = fin.prior.revenue?.value
    if (oiNow !== undefined && revNow && oiThen !== undefined && revThen) {
      const change = oiNow / revNow - oiThen / revThen
      if (change <= -0.03) add('watch', `Operating margin fell ${(Math.abs(change) * 100).toFixed(1)} points from the comparison period.`)
      else if (change >= 0.03) add('good', `Operating margin rose ${(change * 100).toFixed(1)} points from the comparison period.`)
    }
    const rg = m('rev-growth')
    if (rg !== null) {
      if (rg < 0) add('watch', `Revenue fell ${pct(Math.abs(rg))} from the comparison period.`)
      else if (rg >= 0.15) add('good', `Revenue grew ${pct(rg)}.`)
    }
    const gm = m('gross-margin')
    const oi = m('oi-growth')
    if (rg !== null && oi !== null && rg > 0 && oi < 0) {
      add('watch', 'Operating income fell even though revenue grew.')
    }
    if (gm !== null && gm < 0.2) add('info', `Thin gross margin: ${pct(gm)}.`)

    const cr = m('current-ratio')
    if (cr !== null && cr < 1) add('watch', `Short-term bills exceed short-term assets (current ratio ${cr.toFixed(2)}).`)
    const ic = m('interest-coverage')
    if (ic !== null && ic < 2) add('watch', `Operating profit covers interest only ${ic.toFixed(1)}x.`)
    const lev = m('liabilities-assets')
    if (lev !== null && lev > 0.8) add('watch', `Liabilities fund ${pct(lev)} of assets.`)
    const de = m('debt-ebitda')
    if (de !== null && de > 4) add('watch', `Debt equals ${de.toFixed(1)} years of EBITDA.`)
    const debtNow = fin.bsCur.debt?.value
    const debtThen = fin.bsPrior.debt?.value
    const eqNow = fin.bsCur.equity?.value
    const eqThen = fin.bsPrior.equity?.value
    if (debtNow && debtThen && eqNow !== undefined && eqThen !== undefined && debtNow / debtThen >= 1.25 && eqNow <= eqThen) {
      add('watch', `Debt rose ${pct(debtNow / debtThen - 1)} while equity did not grow.`)
    }

    const oc = m('ocf-ni')
    if (oc !== null && oc < 0.8) add('watch', `Cash from operations is only ${oc.toFixed(2)}x reported profit.`)
    else if (oc !== null && oc > 1.2) add('good', `Cash from operations is ${oc.toFixed(2)}x reported profit.`)
    const fm = m('fcf-margin')
    if (fm !== null && fm < 0) add('watch', `Free cash flow is negative (${pct(fm)} of revenue).`)

    const dso = m('dso')
    if (dso !== null && dso > 90) add('info', `Customers take about ${Math.round(dso)} days to pay.`)

    // Most important first: things to watch, then strengths, then context.
    const ranked = out.map((n, i) => ({ n, i })).sort((a, b) => ORDER[a.n.tone] - ORDER[b.n.tone] || a.i - b.i).map(({ n }) => n)
    return { id: 'notes', title: 'Observations', metrics: [], notes: ranked.slice(0, MAX_NOTES) }
  },
}
