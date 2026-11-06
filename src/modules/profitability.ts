import { div, metric, quarterNote } from './helpers'
import type { AnalysisModule } from './types'

export const profitability: AnalysisModule = {
  id: 'profitability',
  title: 'Profitability',
  description: 'Margins, ROA, ROE.',
  requires: ['revenue', 'grossProfit', 'operatingIncome', 'netIncome', 'assets', 'equity'],
  run(fin) {
    const f = fin.annualFactor
    const q = quarterNote(fin.basis)
    const { cur, bsCur } = fin
    return {
      id: 'profitability',
      title: 'Profitability',
      notes: [],
      metrics: [
        metric('gross-margin', 'Gross margin', '%', 'Gross profit / Revenue',
          { 'Gross profit': cur.grossProfit, Revenue: cur.revenue },
          (v) => div(v['Gross profit'], v.Revenue)),
        metric('operating-margin', 'Operating margin', '%', 'Operating income / Revenue',
          { 'Operating income': cur.operatingIncome, Revenue: cur.revenue },
          (v) => div(v['Operating income'], v.Revenue)),
        metric('net-margin', 'Net margin', '%', 'Net income / Revenue',
          { 'Net income': cur.netIncome, Revenue: cur.revenue },
          (v) => div(v['Net income'], v.Revenue)),
        metric('roa', 'Return on assets', '%', `Net income / Total assets${q}`,
          { 'Net income': cur.netIncome, 'Total assets': bsCur.assets },
          (v) => div(v['Net income'] * f, v['Total assets'])),
        metric('roe', 'Return on equity', '%', `Net income / Stockholders' equity${q}`,
          { 'Net income': cur.netIncome, "Stockholders' equity": bsCur.equity },
          (v) => div(v['Net income'] * f, v["Stockholders' equity"])),
        metric('equity-multiplier', 'Equity multiplier', 'x', "Total assets / Stockholders' equity (DuPont leverage term)",
          { 'Total assets': bsCur.assets, "Stockholders' equity": bsCur.equity },
          (v) => div(v['Total assets'], v["Stockholders' equity"])),
      ],
    }
  },
}
