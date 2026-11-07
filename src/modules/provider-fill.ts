import type { Financials } from '@/lib/financials'
import type { Metric, ModuleResult } from './types'

/** Metric id -> provider fundamentals key (see mapFinnhubFundamentals). */
export const PROVIDER_FILL: Record<string, string> = {
  'gross-margin': 'grossMargin',
  'operating-margin': 'operatingMargin',
  'net-margin': 'netMargin',
  roe: 'roe',
  roa: 'roa',
  'current-ratio': 'currentRatio',
  'quick-ratio': 'quickRatio',
  'debt-equity': 'debtEquity',
  'interest-coverage': 'interestCoverage',
  'asset-turnover': 'assetTurnover',
  dso: 'dso',
  dio: 'dio',
  'rev-growth': 'revenueGrowth',
  'eps-growth': 'epsGrowth',
}

/**
 * Fills ratios the filing could not produce with the provider's value, marked source 'provider'.
 * A value computed from the filing is never replaced.
 */
export function fillFromProvider(result: ModuleResult, fin: Financials): ModuleResult {
  const f = fin.market?.fundamentals
  if (!f) return result
  const metrics = result.metrics.map((m): Metric => {
    const key = PROVIDER_FILL[m.id]
    const v = key ? f[key] : undefined
    if (m.value !== null || v === undefined) return m
    return {
      ...m,
      value: v,
      reason: undefined,
      source: 'provider',
      inputs: [{ label: 'Provider (trailing twelve months)', value: v, tag: 'Finnhub' }],
      hint: 'Not available from the filing; provider value, trailing twelve months.',
    }
  })
  return { ...result, metrics }
}
