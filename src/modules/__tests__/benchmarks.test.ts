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
    expect(compare(1.2, 1, 'higher', 'x').flag).toBe('Above')
    expect(compare(1.05, 1, 'higher', 'x').flag).toBe('At')
    expect(compare(0.8, 1, 'higher', 'x').flag).toBe('Below')
  })
  it('reads Favorable/Unfavorable by direction and Neutral for multiples', () => {
    expect(compare(1.2, 1, 'higher', 'x').read).toBe('Favorable')
    expect(compare(1.2, 1, 'lower', 'x').read).toBe('Unfavorable')
    expect(compare(0.8, 1, 'lower', 'x').read).toBe('Favorable')
    expect(compare(1.2, 1, 'neutral', 'x').read).toBe('Neutral')
    expect(compare(1.02, 1, 'higher', 'x').read).toBe('On par')
  })
  it('refuses to compare against a non-positive industry value', () => {
    expect(compare(0.1, -0.02, 'higher', 'x').flag).toBe('n/a')
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
  it('marks multiples n/a without a price, then compares once a price is set', () => {
    const noPrice = runModules({ ...fin(), industry })
    expect(metricOf(noPrice, 'ind-pe').compare).toBeUndefined()
    const cheaper = { ...industry, values: { ...industry.values, pe: 10 } }
    const priced = runModules({ ...fin(), industry: cheaper, price: 30 })
    expect(metricOf(priced, 'ind-pe').compare).toMatchObject({ flag: 'Above', read: 'Neutral' }) // P/E 20 vs 10
    expect(metricOf(runModules({ ...fin(), industry, price: 30 }), 'ind-pe').compare?.read).toBe('On par') // 20 vs 20
  })
})

describe('market module', () => {
  const market: MarketData = { price: 30, priceAsOf: '2026-11-06', source: 'test', ratios: { pe: 40, beta: 1.1, dividendYield: 0.02 } }
  it('lists provider ratios beside filing-based ones and explains big differences', () => {
    const r = runModules({ ...fin(), price: 30, market })
    const pe = r.market.metrics.find((m) => m.id === 'mkt-pe')!
    expect(pe.value).toBe(40)
    expect(pe.inputs.find((i) => i.label === 'Computed from filing')?.value).toBeCloseTo(20)
    expect(r.market.notes.some((n) => /provider 40\.0x vs 20\.0x/.test(n.text))).toBe(true)
    expect(r.market.metrics.find((m) => m.id === 'mkt-beta')).toBeDefined()
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
