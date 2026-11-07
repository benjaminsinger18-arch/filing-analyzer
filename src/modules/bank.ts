import { div, metric } from './helpers'
import type { AnalysisModule } from './types'

/**
 * Banking ratios for filers that report interest income instead of cost of revenue. Every metric
 * needs its inputs, so for a non-bank nothing is produced and nothing is shown.
 */
export const bank: AnalysisModule = {
  id: 'bank',
  title: 'Banking',
  description: 'Net interest income, efficiency, deposits and loans.',
  requires: ['netInterestIncome', 'nonInterestExpense', 'assets'],
  run(fin) {
    const y = fin.cur
    const f = fin.annualFactor
    const b = fin.bsCur
    const revenue =
      y.netInterestIncome && y.nonInterestIncome
        ? { value: y.netInterestIncome.value + y.nonInterestIncome.value, tag: 'net interest income + noninterest income' }
        : undefined
    return {
      id: 'bank',
      title: 'Banking',
      notes: [],
      metrics: [
        metric('nii', 'Net interest income', 'usd', 'Interest income - Interest expense',
          { 'Net interest income': y.netInterestIncome, 'Noninterest expense': y.nonInterestExpense }, (v) => v['Net interest income']),
        metric('nim', 'Net interest margin (approx.)', '%', 'Net interest income / Total assets',
          { 'Net interest income': y.netInterestIncome, 'Noninterest expense': y.nonInterestExpense, 'Total assets': b.assets }, (v) => div(v['Net interest income'] * f, v['Total assets']),
          'Uses total assets, not earning assets, so it reads lower than a reported margin.'),
        metric('efficiency', 'Efficiency ratio', '%', 'Noninterest expense / (Net interest income + Noninterest income)',
          { 'Noninterest expense': y.nonInterestExpense, Revenue: revenue }, (v) => div(v['Noninterest expense'], v.Revenue),
          'Lower is better.'),
        metric('nonint-share', 'Noninterest income share', '%', 'Noninterest income / (Net interest income + Noninterest income)',
          { 'Noninterest income': y.nonInterestIncome, Revenue: revenue }, (v) => div(v['Noninterest income'], v.Revenue)),
        metric('provision-rev', 'Credit loss provision / revenue', '%', 'Provision for credit losses / (Net interest income + Noninterest income)',
          { Provision: y.provision, Revenue: revenue }, (v) => div(v.Provision, v.Revenue), 'Lower is better.'),
        metric('loans-deposits', 'Loans / deposits', '%', 'Loans / Deposits',
          { Loans: b.loans, Deposits: b.deposits }, (v) => div(v.Loans, v.Deposits)),
        metric('equity-assets', 'Equity / assets', '%', "Stockholders' equity / Total assets",
          { "Stockholders' equity": b.equity, 'Total assets': b.assets, 'Net interest income': y.netInterestIncome },
          (v) => div(v["Stockholders' equity"], v['Total assets'])),
      ],
    }
  },
}
