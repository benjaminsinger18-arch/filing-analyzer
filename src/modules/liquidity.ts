import { div, metric } from './helpers'
import type { AnalysisModule } from './types'

export const liquidity: AnalysisModule = {
  id: 'liquidity',
  title: 'Liquidity',
  description: 'Ability to meet short-term obligations.',
  requires: ['currentAssets', 'currentLiabilities', 'cash', 'inventory'],
  run(fin) {
    const b = fin.bsCur
    return {
      id: 'liquidity',
      title: 'Liquidity',
      notes: [],
      metrics: [
        metric('current-ratio', 'Current ratio', 'x', 'Current assets / Current liabilities',
          { 'Current assets': b.currentAssets, 'Current liabilities': b.currentLiabilities },
          (v) => div(v['Current assets'], v['Current liabilities'])),
        metric('quick-ratio', 'Quick ratio', 'x', '(Current assets - Inventory) / Current liabilities',
          { 'Current assets': b.currentAssets, Inventory: b.inventory ?? { value: 0, tag: 'no inventory reported (treated as 0)' }, 'Current liabilities': b.currentLiabilities },
          (v) => div(v['Current assets'] - v.Inventory, v['Current liabilities'])),
        metric('cash-ratio', 'Cash ratio', 'x', 'Cash & equivalents / Current liabilities',
          { Cash: b.cash, 'Current liabilities': b.currentLiabilities },
          (v) => div(v.Cash, v['Current liabilities'])),
        metric('working-capital', 'Working capital', 'usd', 'Current assets - Current liabilities',
          { 'Current assets': b.currentAssets, 'Current liabilities': b.currentLiabilities },
          (v) => v['Current assets'] - v['Current liabilities']),
      ],
    }
  },
}
