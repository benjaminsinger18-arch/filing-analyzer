import { div, metric, quarterNote } from './helpers'
import type { AnalysisModule } from './types'

export const efficiency: AnalysisModule = {
  id: 'efficiency',
  title: 'Efficiency',
  description: 'Turnover and working-capital days.',
  requires: ['revenue', 'cogs', 'assets', 'receivables', 'inventory', 'payables'],
  run(fin) {
    const f = fin.annualFactor
    const d = 365 / f
    const q = quarterNote(fin.basis)
    const { cur, bsCur } = fin
    const dso = metric('dso', 'Days sales outstanding', 'days', 'Receivables / Revenue x days in period',
      { Receivables: bsCur.receivables, Revenue: cur.revenue }, (v) => div(v.Receivables, v.Revenue) === null ? null : (v.Receivables / v.Revenue) * d)
    const dio = metric('dio', 'Days inventory outstanding', 'days', 'Inventory / Cost of revenue x days in period',
      { Inventory: bsCur.inventory, 'Cost of revenue': cur.cogs }, (v) => div(v.Inventory, v['Cost of revenue']) === null ? null : (v.Inventory / v['Cost of revenue']) * d)
    const dpo = metric('dpo', 'Days payables outstanding', 'days', 'Accounts payable / Cost of revenue x days in period',
      { 'Accounts payable': bsCur.payables, 'Cost of revenue': cur.cogs }, (v) => div(v['Accounts payable'], v['Cost of revenue']) === null ? null : (v['Accounts payable'] / v['Cost of revenue']) * d)
    const ccc = metric('ccc', 'Cash conversion cycle', 'days', 'DSO + DIO - DPO',
      {
        DSO: dso.value === null ? undefined : { value: dso.value, tag: 'computed above' },
        DIO: dio.value === null ? undefined : { value: dio.value, tag: 'computed above' },
        DPO: dpo.value === null ? undefined : { value: dpo.value, tag: 'computed above' },
      },
      (v) => v.DSO + v.DIO - v.DPO)
    return {
      id: 'efficiency',
      title: 'Efficiency',
      notes: [],
      metrics: [
        metric('asset-turnover', 'Asset turnover', 'x', `Revenue / Total assets${q}`,
          { Revenue: cur.revenue, 'Total assets': bsCur.assets }, (v) => div(v.Revenue * f, v['Total assets'])),
        dso,
        dio,
        dpo,
        ccc,
      ],
    }
  },
}
