import { div, metric } from './helpers'
import type { AnalysisModule, Metric, Note } from './types'
import type { Financials } from '@/lib/financials'

type Test = { name: string; pass: boolean | null }

/** Piotroski F-score (9 binary tests). Needs the prior-year comparatives, so annual filings only. */
export function piotroski(fin: Financials): { score: number | null; tests: Test[] } {
  const { cur, prior, bsCur, bsPrior, ytd } = fin
  const roa = (ni?: number, a?: number) => (ni === undefined || a === undefined ? null : div(ni, a))
  const roaCur = roa(cur.netIncome?.value, bsCur.assets?.value)
  const roaPrior = roa(prior.netIncome?.value, bsPrior.assets?.value)
  const lev = (b: typeof bsCur) => (b.debt && b.assets ? b.debt.value / b.assets.value : null)
  const cr = (b: typeof bsCur) => (b.currentAssets && b.currentLiabilities ? b.currentAssets.value / b.currentLiabilities.value : null)
  const gm = (i: typeof cur) => (i.grossProfit && i.revenue ? i.grossProfit.value / i.revenue.value : null)
  const at = (i: typeof cur, b: typeof bsCur) => (i.revenue && b.assets ? i.revenue.value / b.assets.value : null)
  const lt = (a: number | null, b: number | null, rule: (x: number, y: number) => boolean) =>
    a === null || b === null ? null : rule(a, b)
  const tests: Test[] = [
    { name: 'Positive net income', pass: cur.netIncome ? cur.netIncome.value > 0 : null },
    { name: 'Positive operating cash flow', pass: ytd.ocf ? ytd.ocf.value > 0 : null },
    { name: 'ROA improved', pass: lt(roaCur, roaPrior, (a, b) => a > b) },
    { name: 'Cash flow exceeds net income', pass: ytd.ocf && cur.netIncome ? ytd.ocf.value > cur.netIncome.value : null },
    { name: 'Debt / assets fell', pass: lt(lev(bsCur), lev(bsPrior), (a, b) => a < b) },
    { name: 'Current ratio improved', pass: lt(cr(bsCur), cr(bsPrior), (a, b) => a > b) },
    { name: 'No increase in diluted share count', pass: cur.dilutedShares && prior.dilutedShares ? cur.dilutedShares.value <= prior.dilutedShares.value : null },
    { name: 'Gross margin improved', pass: lt(gm(cur), gm(prior), (a, b) => a > b) },
    { name: 'Asset turnover improved', pass: lt(at(cur, bsCur), at(prior, bsPrior), (a, b) => a > b) },
  ]
  const testable = tests.filter((t) => t.pass !== null)
  if (testable.length < 6) return { score: null, tests }
  return { score: testable.filter((t) => t.pass).length, tests }
}

export const scores: AnalysisModule = {
  id: 'scores',
  title: 'Quality & distress scores',
  description: "Piotroski F-score, Altman Z''.",
  requires: ['netIncome', 'ocf', 'assets', 'currentAssets', 'currentLiabilities', 'retainedEarnings', 'operatingIncome', 'liabilities', 'equity'],
  run(fin) {
    const notes: Note[] = []
    const b = fin.bsCur
    const f = fin.annualFactor

    const altman: Metric = metric('altman', "Altman Z''-score", 'score',
      "6.56*WC/TA + 3.26*RE/TA + 6.72*EBIT/TA + 1.05*Equity/Liabilities",
      {
        'Current assets': b.currentAssets,
        'Current liabilities': b.currentLiabilities,
        'Retained earnings': b.retainedEarnings,
        'Operating income (EBIT)': fin.cur.operatingIncome,
        'Total assets': b.assets,
        'Total liabilities': b.liabilities,
        "Stockholders' equity": b.equity,
      },
      (v) => {
        const ta = v['Total assets']
        const tl = v['Total liabilities']
        if (ta === 0 || tl === 0) return null
        return (
          6.56 * ((v['Current assets'] - v['Current liabilities']) / ta) +
          3.26 * (v['Retained earnings'] / ta) +
          6.72 * ((v['Operating income (EBIT)'] * f) / ta) +
          1.05 * (v["Stockholders' equity"] / tl)
        )
      },
      "Above 2.6 safe, 1.1-2.6 grey, below 1.1 distress. Unreliable for banks and insurers.",
    )
    if (altman.value !== null) {
      const z = altman.value
      notes.push({
        tone: z > 2.6 ? 'good' : z >= 1.1 ? 'info' : 'watch',
        text: `Altman Z'' of ${z.toFixed(2)} falls in the ${z > 2.6 ? 'safe' : z >= 1.1 ? 'grey' : 'distress'} zone of this model.`,
      })
    }

    let piotroskiMetric: Metric
    if (fin.basis === 'quarter') {
      piotroskiMetric = {
        id: 'piotroski', label: 'Piotroski F-score', value: null, unit: 'score',
        formula: 'Count of 9 binary tests', inputs: [], reason: 'Annual filings only',
      }
    } else {
      const p = piotroski(fin)
      piotroskiMetric = {
        id: 'piotroski', label: 'Piotroski F-score', value: p.score, unit: 'score',
        formula: 'Count of 9 binary tests (profitability, leverage/liquidity, efficiency)',
        inputs: p.tests.map((t) => ({ label: t.name, value: t.pass === null ? NaN : t.pass ? 1 : 0, tag: t.pass === null ? 'not testable' : t.pass ? 'pass' : 'fail' })),
        reason: p.score === null ? 'Fewer than 6 of 9 tests testable' : undefined,
        hint: '8-9 strong, 4-7 middling, 0-3 weak.',
      }
      if (p.score !== null) {
        const failed = p.tests.filter((t) => t.pass === false).map((t) => t.name.toLowerCase())
        notes.push({
          tone: p.score >= 7 ? 'good' : p.score >= 4 ? 'info' : 'watch',
          text: `Piotroski F-score is ${p.score} of 9${failed.length ? `; tests not passed: ${failed.join(', ')}` : ''}.`,
        })
      }
    }
    return { id: 'scores', title: 'Quality & distress scores', metrics: [piotroskiMetric, altman], notes }
  },
}
