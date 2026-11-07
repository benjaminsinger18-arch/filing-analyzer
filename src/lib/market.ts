import type { MarketRatios } from './financials'

export const toNum = (v: unknown): number | undefined => {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN
  return Number.isFinite(n) ? n : undefined
}

const first = (m: Record<string, unknown>, keys: string[]): number | undefined => {
  for (const k of keys) {
    const n = toNum(m[k])
    if (n !== undefined) return n
  }
  return undefined
}

/**
 * Maps Finnhub's /stock/metric?metric=all `metric` object to our ratio shape. Each ratio tries a few
 * candidate keys; anything the provider does not return is simply left out of the result.
 * Finnhub reports market cap in millions and dividend yield in percent.
 */
export function mapFinnhubMetrics(m: Record<string, unknown>): MarketRatios {
  const capM = first(m, ['marketCapitalization'])
  const yieldPct = first(m, ['dividendYieldIndicatedAnnual', 'currentDividendYieldTTM'])
  const r: MarketRatios = {
    pe: first(m, ['peTTM', 'peBasicExclExtraTTM', 'peExclExtraTTM', 'peNormalizedAnnual']),
    forwardPe: first(m, ['forwardPE', 'peForward']),
    peg: first(m, ['pegRatio', 'pegTTM']),
    evEbitda: first(m, ['evEbitdaTTM', 'enterpriseValueOverEBITDATTM', 'currentEv/ebitdaTTM']),
    evRevenue: first(m, ['evRevenueTTM', 'enterpriseValueOverRevenueTTM', 'currentEv/revenueTTM']),
    pb: first(m, ['pbQuarterly', 'pbAnnual']),
    beta: first(m, ['beta']),
    dividendYield: yieldPct === undefined ? undefined : yieldPct / 100,
    marketCap: capM === undefined ? undefined : capM * 1_000_000,
  }
  return Object.fromEntries(Object.entries(r).filter(([, v]) => v !== undefined)) as MarketRatios
}
