import type { Financials } from '@/lib/financials'
import { RATIO_MODULES, runModules } from './registry'
import { INDUSTRY_ROW_FOR } from './industry'

/** Which side of a change is favorable. Metrics not listed are not judged. */
export const GOOD_DIRECTION: Record<string, 'higher' | 'lower'> = {
  'gross-margin': 'higher',
  'operating-margin': 'higher',
  'ebitda-margin': 'higher',
  'net-margin': 'higher',
  roe: 'higher',
  roa: 'higher',
  'current-ratio': 'higher',
  'quick-ratio': 'higher',
  'interest-coverage': 'higher',
  'asset-turnover': 'higher',
  'rev-growth': 'higher',
  'oi-growth': 'higher',
  'eps-growth': 'higher',
  'ocf-ni': 'higher',
  'fcf-margin': 'higher',
  piotroski: 'higher',
  altman: 'higher',
  'debt-equity': 'lower',
  'debt-capital': 'lower',
  'debt-ebitda': 'lower',
  'liabilities-assets': 'lower',
  dso: 'lower',
  dio: 'lower',
  efficiency: 'lower',
  'provision-rev': 'lower',
}

const SKIP = new Set(['industry', 'market', 'valuation'])

/** The filing's own prior-year figures as a Financials of their own, so ratios can be recomputed for that period. */
function asPriorPeriod(fin: Financials): Financials {
  return {
    ...fin,
    cur: fin.prior,
    prior: {},
    ytd: fin.ytdPrior,
    ytdPrior: {},
    bsCur: fin.bsPrior,
    bsPrior: {},
    price: undefined,
    market: undefined,
    industry: undefined,
  }
}

/** Ratio values one year earlier, by metric id. Growth ratios and anything lacking prior inputs are absent. */
export function priorValues(fin: Financials): Record<string, number> {
  const res = runModules(asPriorPeriod(fin))
  const out: Record<string, number> = {}
  for (const mod of RATIO_MODULES) {
    if (SKIP.has(mod.id)) continue
    for (const m of res[mod.id]?.metrics ?? []) if (m.value !== null) out[m.id] = m.value
  }
  return out
}

export { INDUSTRY_ROW_FOR }
