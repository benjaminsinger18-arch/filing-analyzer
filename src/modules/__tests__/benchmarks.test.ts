import { describe, expect, it } from 'vitest'
import benchmarks from '@/data/industry-benchmarks.json'
import tickers from '@/data/industry-tickers.json'
import { buildFixture } from '@/lib/ixbrl/__tests__/fixture'
import { normalize } from '@/lib/ixbrl/normalize'
import { parseIxbrl } from '@/lib/ixbrl/parse'
import type { IndustryBenchmark, MarketData } from '@/lib/financials'
import { mapFinnhubMetrics } from '@/lib/market'
import { compare } from '../industry'
import { runModules } from '../registry'

const fin = () => normalize(parseIxbrl(buildFixture()))
const industry: IndustryBenchmark = {
  name: 'Test Industry',
  asOf: '2026-01-05',
  firms: 10,
  values: { grossMargin: 0.3, operatingMargin: 0.2, netMargin: 0.2, roe: 0.1, bookDebtToCapital: 0.4, interestCoverage: 10, debtToEbitda: 3, pe: 20, pb: 3, evEbitda: 10, evSales: 3 },
}
const metricOf = (r: ReturnType<typeof runModules>, id: string) => r.industry.metrics.find((m) => m.id === id)!

describe('compare', () => {
  it('flags Above/At/Below with a 10% tolerance', () => {
    expect(compare(1.2, 1, 'higher', false).flag).toBe('Above')
    expect(compare(1.05, 1, 'higher', false).flag).toBe('At')
    expect(compare(0.8, 1, 'higher', false).flag).toBe('Below')
  })
  it('reads Favorable/Unfavorable by direction and Neutral for multiples', () => {
    expect(compare(1.2, 1, 'higher', false).read).toBe('Favorable')
    expect(compare(1.2, 1, 'lower', false).read).toBe('Unfavorable')
    expect(compare(0.8, 1, 'lower', false).read).toBe('Favorable')
    expect(compare(1.2, 1, 'neutral', false).read).toBe('Neutral')
    expect(compare(1.02, 1, 'higher', false).read).toBe('On par')
  })
  it('compares percent metrics in percentage points when the benchmark is negative', () => {
    const r = compare(1.18, -0.002, 'higher', true)
    expect(r.deltaPct).toBeNull()
    expect(r.deltaPts).toBeCloseTo(1.182)
    expect(r).toMatchObject({ flag: 'Above', read: 'Favorable' })
    expect(r.note).toMatch(/negative/)
    expect(compare(-0.01, -0.02, 'higher', true).flag).toBe('At') // 1 point apart: within the 2-point floor
  })
  it('gives n/a with a reason for a non-positive multiple or a missing benchmark', () => {
    expect(compare(20, -5, 'neutral', false)).toMatchObject({ flag: 'n/a', note: expect.stringMatching(/not meaningful/) })
    expect(compare(20, null, 'neutral', false)).toMatchObject({ flag: 'n/a', note: 'No benchmark figure' })
  })
})

describe('industry module', () => {
  it('compares fixture metrics with the industry row', () => {
    const r = runModules({ ...fin(), industry })
    // fixture: gross margin 40% vs 30% -> Above, Favorable; debt/capital 400/(400+1100)=26.7% vs 40% -> Below, Favorable
    expect(metricOf(r, 'ind-gross-margin').compare).toMatchObject({ flag: 'Above', read: 'Favorable' })
    expect(metricOf(r, 'ind-debt-capital').value).toBeCloseTo(400 / 1500)
    expect(metricOf(r, 'ind-debt-capital').compare).toMatchObject({ flag: 'Below', read: 'Favorable' })
    expect(r.industry.notes[0].text).toMatch(/better than the industry average/)
  })
  it('shows a note instead of rows when no industry is matched', () => {
    const r = runModules(fin())
    expect(r.industry.metrics).toHaveLength(0)
    expect(r.industry.notes[0].text).toMatch(/Pick one/)
  })
  it('explains a missing company value with the specific reason, then compares once a price is set', () => {
    const noPrice = runModules({ ...fin(), industry })
    expect(metricOf(noPrice, 'ind-pe').compare).toBeUndefined()
    expect(metricOf(noPrice, 'ind-pe').reason).toMatch(/share price/)
    const cheaper = { ...industry, values: { ...industry.values, pe: 10 } }
    const priced = runModules({ ...fin(), industry: cheaper, price: 30 })
    expect(metricOf(priced, 'ind-pe').compare).toMatchObject({ flag: 'Above', read: 'Neutral' }) // P/E 20 vs 10
    expect(metricOf(runModules({ ...fin(), industry, price: 30 }), 'ind-pe').compare?.read).toBe('On par') // 20 vs 20
  })
  it('shows percentage points instead of a blank row for a negative industry ROE', () => {
    const negRoe = { ...industry, values: { ...industry.values, roe: -0.002 } }
    const m = metricOf(runModules({ ...fin(), industry: negRoe }), 'ind-roe')
    expect(m.compare?.flag).toBe('Above')
    expect(m.compare?.deltaPts).toBeCloseTo(150 / 1100 + 0.002)
    expect(m.compare?.deltaPct).toBeNull()
  })
  it('adds a total-market comparison column and uses it when the industry row has no figure', () => {
    const withMarket: IndustryBenchmark = {
      ...industry,
      values: { ...industry.values, roe: null },
      market: { name: 'Total Market (without financials)', firms: 4000, values: { roe: 0.1, grossMargin: 0.35 } },
    }
    const r = runModules({ ...fin(), industry: withMarket })
    expect(metricOf(r, 'ind-roe').compare?.flag).toBe('n/a')
    expect(metricOf(r, 'ind-roe').compare?.market).toMatchObject({ flag: 'Above', name: 'Total Market (without financials)' })
    expect(metricOf(r, 'ind-gross-margin').compare?.market?.benchmark).toBe(0.35)
  })
  it('falls back to the provider multiple when the filing-based one is not computable', () => {
    const market: MarketData = { ticker: 'TEST', price: 30, priceAsOf: null, source: 'test', ratios: { pe: 25 } }
    // no price in the filing context, so P/E from the filing is n/a; the provider value fills in
    const m = metricOf(runModules({ ...fin(), industry, market }), 'ind-pe')
    expect(m.value).toBe(25)
    expect(m.compare?.companySource).toBe('provider')
  })
  it('does not depend on any display toggle: industry, rating and notes are always computed', () => {
    const r = runModules({ ...fin(), industry })
    for (const id of ['profitability', 'liquidity', 'leverage', 'efficiency', 'growth', 'cashflow', 'scores', 'valuation', 'industry', 'market', 'rating', 'notes']) {
      expect(r[id], id).toBeDefined()
    }
    expect(r.rating.rating?.used).toBe(5)
    expect(metricOf(r, 'ind-operating-margin').value).toBeCloseTo(0.2)
  })
})

describe('market module', () => {
  const market: MarketData = { ticker: 'TEST', price: 30, priceAsOf: '2026-11-06', source: 'test', ratios: { pe: 40, beta: 1.1, dividendYield: 0.02 } }
  it('lists provider ratios beside filing-based ones and explains big differences', () => {
    const r = runModules({ ...fin(), price: 30, market })
    const pe = r.market.metrics.find((m) => m.id === 'mkt-pe')!
    expect(pe.value).toBe(40)
    expect(pe.inputs.find((i) => i.label === 'Computed from filing')?.value).toBeCloseTo(20)
    expect(r.market.notes.some((n) => /provider 40\.0x vs 20\.0x/.test(n.text))).toBe(true)
    expect(r.market.metrics.find((m) => m.id === 'mkt-beta')).toBeDefined()
  })
  it('computes filing-based counterparts for market cap and dividend yield', () => {
    const html = buildFixture().replace('</body>', '<ix:nonFraction name="us-gaap:PaymentsOfDividends" contextRef="FY24" unitRef="usd" decimals="-6" scale="6">20</ix:nonFraction></body>')
    const f = normalize(parseIxbrl(html))
    const r = runModules({ ...f, price: 30, market })
    const mcap = r.valuation.metrics.find((m) => m.id === 'mcap')!.value!
    expect(r.valuation.metrics.find((m) => m.id === 'div-yield')!.value).toBeCloseTo((20 * 1e6) / mcap)
    const rm = runModules({ ...f, price: 30, market: { ...market, ratios: { marketCap: 3e9, dividendYield: 0.02 } } })
    expect(rm.market.metrics.find((m) => m.id === 'mkt-cap')!.inputs.some((i) => i.label === 'Computed from filing')).toBe(true)
    expect(rm.market.metrics.find((m) => m.id === 'mkt-dividend-yield')!.inputs.some((i) => i.label === 'Computed from filing')).toBe(true)
  })
  it('shows the provider note when ratios are unavailable', () => {
    const r = runModules({ ...fin(), market: { ...market, ratios: {}, ratiosNote: 'Set FINNHUB_API_KEY' } })
    expect(r.market.metrics).toHaveLength(0)
    expect(r.market.notes[0].text).toBe('Set FINNHUB_API_KEY')
  })
})

describe('mapFinnhubMetrics', () => {
  it('maps units: market cap in millions, dividend yield in percent', () => {
    const r = mapFinnhubMetrics({ peTTM: 30.5, pbQuarterly: 40, marketCapitalization: 3000000, dividendYieldIndicatedAnnual: 0.5, beta: 1.2 })
    expect(r).toEqual({ pe: 30.5, pb: 40, marketCap: 3e12, dividendYield: 0.005, beta: 1.2 })
  })
  it('maps the field names Finnhub actually returns (checked live for AAPL)', () => {
    const r = mapFinnhubMetrics({
      peTTM: 37.8436, forwardPE: 35.75579, pegTTM: 3.06221, evEbitdaTTM: 29.4239, evRevenueTTM: 10.5376,
      pbQuarterly: 44.0587, beta: 1.0839877, dividendYieldIndicatedAnnual: 0.50534, marketCapitalization: 5001977,
    })
    expect(r).toMatchObject({ pe: 37.8436, forwardPe: 35.75579, peg: 3.06221, evEbitda: 29.4239, evRevenue: 10.5376, pb: 44.0587, beta: 1.0839877 })
    expect(r.dividendYield).toBeCloseTo(0.0050534)
    expect(r.marketCap).toBe(5001977e6)
  })
  it('drops missing or non-numeric values', () => {
    expect(mapFinnhubMetrics({ peTTM: null, beta: 'x' })).toEqual({})
  })
})

describe('bundled Damodaran data', () => {
  it('maps well-known US tickers to industries that have benchmark rows', () => {
    const map = tickers.tickers as Record<string, string>
    for (const t of ['AAPL', 'MSFT', 'JPM', 'XOM']) {
      expect(map[t], t).toBeTruthy()
      expect((benchmarks.industries as Record<string, unknown>)[map[t]], t).toBeDefined()
    }
    expect(map.AAPL).toBe('Computers/Peripherals')
  })
  it('has the expected columns for an industry', () => {
    const row = (benchmarks.industries as Record<string, Record<string, number | null>>)['Computers/Peripherals']
    for (const k of ['grossMargin', 'operatingMargin', 'netMargin', 'roe', 'bookDebtToCapital', 'pe', 'pb', 'evEbitda', 'evSales']) {
      expect(typeof row[k], k).toBe('number')
    }
  })
})
