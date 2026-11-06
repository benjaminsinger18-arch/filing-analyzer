import { div, metric } from './helpers'
import type { AnalysisModule } from './types'

export const leverage: AnalysisModule = {
  id: 'leverage',
  title: 'Leverage & solvency',
  description: 'Debt, coverage, solvency.',
  requires: ['debt', 'equity', 'liabilities', 'assets', 'interestExpense', 'operatingIncome'],
  run(fin) {
    const b = fin.bsCur
    const annual = fin.basis === 'annual'
    const annualOnly = 'Annual filings only'
    const ebitda = annual
      ? fin.ytd.operatingIncome && fin.ytd.da
        ? { value: fin.ytd.operatingIncome.value + fin.ytd.da.value, tag: 'OperatingIncomeLoss + D&A' }
        : undefined
      : undefined
    const debtToEbitda = metric('debt-ebitda', 'Debt / EBITDA', 'x', 'Total debt / (Operating income + D&A)',
      { 'Total debt': b.debt, EBITDA: ebitda }, (v) => div(v['Total debt'], v.EBITDA))
    if (!annual) debtToEbitda.reason = annualOnly
    return {
      id: 'leverage',
      title: 'Leverage & solvency',
      notes: [],
      metrics: [
        metric('debt-equity', 'Debt / equity', 'x', "Total debt / Stockholders' equity",
          { 'Total debt': b.debt, "Stockholders' equity": b.equity },
          (v) => div(v['Total debt'], v["Stockholders' equity"]),
          'Sum of reported debt tags; see inputs.'),
        metric('net-debt', 'Net debt', 'usd', 'Total debt - Cash & equivalents',
          { 'Total debt': b.debt, Cash: b.cash }, (v) => v['Total debt'] - v.Cash),
        metric('interest-coverage', 'Interest coverage', 'x', 'Operating income / Interest expense',
          { 'Operating income': fin.cur.operatingIncome, 'Interest expense': fin.cur.interestExpense },
          (v) => div(v['Operating income'], v['Interest expense'])),
        metric('liabilities-assets', 'Liabilities / assets', '%', 'Total liabilities / Total assets',
          { 'Total liabilities': b.liabilities, 'Total assets': b.assets },
          (v) => div(v['Total liabilities'], v['Total assets'])),
        annual ? debtToEbitda : debtToEbitda,
      ],
    }
  },
}
