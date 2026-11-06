import { div, metric } from './helpers'
import type { AnalysisModule } from './types'

export const cashflow: AnalysisModule = {
  id: 'cashflow',
  title: 'Cash-flow quality',
  description: 'OCF, FCF, accruals.',
  requires: ['ocf', 'capex', 'netIncome', 'revenue', 'assets'],
  run(fin) {
    const y = fin.ytd
    const ytdNote = fin.basis === 'quarter' ? ' (year-to-date)' : ''
    const fcf =
      y.ocf && y.capex ? { value: y.ocf.value - y.capex.value, tag: 'OCF - capex' } : undefined
    return {
      id: 'cashflow',
      title: 'Cash-flow quality',
      notes: [],
      metrics: [
        metric('ocf-ni', 'OCF / net income', 'x', `Operating cash flow / Net income${ytdNote}`,
          { 'Operating cash flow': y.ocf, 'Net income': y.netIncome }, (v) => (v['Net income'] <= 0 ? null : v['Operating cash flow'] / v['Net income'])),
        metric('fcf', 'Free cash flow', 'usd', `Operating cash flow - Capex${ytdNote}`,
          { 'Operating cash flow': y.ocf, Capex: y.capex }, (v) => v['Operating cash flow'] - v.Capex),
        metric('fcf-margin', 'FCF margin', '%', `Free cash flow / Revenue${ytdNote}`,
          { 'Free cash flow': fcf, Revenue: y.revenue }, (v) => div(v['Free cash flow'], v.Revenue)),
        metric('accruals', 'Accruals ratio', '%', `(Net income - OCF) / Total assets${ytdNote}`,
          { 'Net income': y.netIncome, 'Operating cash flow': y.ocf, 'Total assets': fin.bsCur.assets },
          (v) => div(v['Net income'] - v['Operating cash flow'], v['Total assets']),
          'High positive values mean earnings rely on accruals.'),
      ],
    }
  },
}
