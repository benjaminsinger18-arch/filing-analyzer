import { growth, metric } from './helpers'
import type { AnalysisModule } from './types'
import type { InputMap } from './types'
import type { LineItem } from '@/lib/financials'

export const growthModule: AnalysisModule = {
  id: 'growth',
  title: 'Growth',
  description: 'Change versus the same period a year earlier.',
  requires: ['revenue', 'operatingIncome', 'netIncome', 'epsDiluted'],
  run(fin) {
    const vs = fin.basis === 'annual' ? 'prior fiscal year' : 'same quarter last year'
    const g = (id: string, label: string, item: LineItem) => {
      const inputs: InputMap = { Current: fin.cur[item], Prior: fin.prior[item] }
      return metric(id, label, '%', `(Current - Prior) / Prior, vs ${vs}`, inputs, (v) => growth(v.Current, v.Prior))
    }
    return {
      id: 'growth',
      title: 'Growth',
      notes: [],
      metrics: [
        g('rev-growth', 'Revenue growth', 'revenue'),
        g('oi-growth', 'Operating income growth', 'operatingIncome'),
        g('ni-growth', 'Net income growth', 'netIncome'),
        g('eps-growth', 'Diluted EPS growth', 'epsDiluted'),
      ],
    }
  },
}
