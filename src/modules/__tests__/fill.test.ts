import { describe, expect, it } from 'vitest'
import { buildFixture } from '@/lib/ixbrl/__tests__/fixture'
import { normalize } from '@/lib/ixbrl/normalize'
import { parseIxbrl } from '@/lib/ixbrl/parse'
import type { IndustryBenchmark, MarketData } from '@/lib/financials'
import { mapFinnhubFundamentals } from '@/lib/market'
import { runModules } from '../registry'

const M = 1e6
const fin = (html = buildFixture()) => normalize(parseIxbrl(html))
const metric = (r: ReturnType<typeof runModules>, id: string) => Object.values(r).flatMap((x) => x.metrics).find((m) => m.id === id)!
const market = (fundamentals: Record<string, number>): MarketData => ({ ticker: 'T', price: 30, priceAsOf: null, source: 'test', ratios: {}, fundamentals })

describe('provider fill', () => {
  it('fills a ratio the filing cannot produce and marks it as provider data', () => {
    const noInventory = buildFixture().replace(/<ix:nonFraction name="us-gaap:InventoryNet"[^<]*<\/ix:nonFraction>/, '')
    const r = runModules({ ...fin(noInventory), market: market({ dio: 22 }) })
    const dio = metric(r, 'dio')
    expect(dio.value).toBe(22)
    expect(dio.source).toBe('provider')
    expect(dio.inputs[0].tag).toBe('Finnhub')
  })
  it('never replaces a value computed from the filing', () => {
    const r = runModules({ ...fin(), market: market({ grossMargin: 0.9, interestCoverage: 999, dso: 1 }) })
    expect(metric(r, 'gross-margin').value).toBeCloseTo(0.4)
    expect(metric(r, 'gross-margin').source).toBeUndefined()
    expect(metric(r, 'interest-coverage').value).toBeCloseTo(20)
  })
  it('lets later modules (industry) use the filled value', () => {
    const noInterest = buildFixture().replace('us-gaap:InterestExpense"', 'us-gaap:SomethingElse"')
    const industry: IndustryBenchmark = { name: 'X', asOf: '2026-01-05', firms: 5, values: { interestCoverage: 10 } }
    const r = runModules({ ...fin(noInterest), industry, market: market({ interestCoverage: 30 }) })
    const row = r.industry.metrics.find((m) => m.id === 'ind-interest-coverage')!
    expect(row.value).toBe(30)
    expect(row.compare?.companySource).toBe('provider')
    expect(row.compare?.flag).toBe('Above')
  })
  it('changes nothing without provider fundamentals', () => {
    const a = runModules(fin())
    const b = runModules({ ...fin(), market: { ...market({}), fundamentals: undefined } })
    expect(metric(a, 'dso').value).toBe(metric(b, 'dso').value)
  })
})

describe('mapFinnhubFundamentals', () => {
  it('converts percents to fractions and turnover to days', () => {
    const f = mapFinnhubFundamentals({
      grossMarginTTM: 48.79, roeTTM: 127.61, currentRatioQuarterly: 1.0232, 'totalDebt/totalEquityQuarterly': 0.7147,
      receivablesTurnoverTTM: 11.4562, netInterestCoverageTTM: 622.5, revenueGrowthTTMYoy: 15.06,
    })
    expect(f.grossMargin).toBeCloseTo(0.4879)
    expect(f.roe).toBeCloseTo(1.2761)
    expect(f.currentRatio).toBeCloseTo(1.0232)
    expect(f.debtEquity).toBeCloseTo(0.7147)
    expect(f.dso).toBeCloseTo(365 / 11.4562)
    expect(f.interestCoverage).toBeCloseTo(622.5)
    expect(f.revenueGrowth).toBeCloseTo(0.1506)
  })
  it('drops missing, non-numeric and non-positive turnover values', () => {
    expect(mapFinnhubFundamentals({ grossMarginTTM: null, receivablesTurnoverTTM: 0, inventoryTurnoverTTM: 'x' })).toEqual({})
  })
})

describe('banking module', () => {
  const bankHtml = buildFixture().replace(
    '</body>',
    ['<ix:nonFraction name="us-gaap:InterestIncomeExpenseNet" contextRef="FY24" unitRef="usd" decimals="-6" scale="6">300</ix:nonFraction>',
     '<ix:nonFraction name="us-gaap:NoninterestIncome" contextRef="FY24" unitRef="usd" decimals="-6" scale="6">200</ix:nonFraction>',
     '<ix:nonFraction name="us-gaap:NoninterestExpense" contextRef="FY24" unitRef="usd" decimals="-6" scale="6">280</ix:nonFraction>',
     '<ix:nonFraction name="us-gaap:ProvisionForLoanLeaseAndOtherLosses" contextRef="FY24" unitRef="usd" decimals="-6" scale="6">20</ix:nonFraction>',
     '<ix:nonFraction name="us-gaap:Deposits" contextRef="E24" unitRef="usd" decimals="-6" scale="6">1,500</ix:nonFraction>',
     '<ix:nonFraction name="us-gaap:LoansAndLeasesReceivableNetReportedAmount" contextRef="E24" unitRef="usd" decimals="-6" scale="6">900</ix:nonFraction></body>'].join(''),
  )
  it('computes bank ratios from reported interest and noninterest lines', () => {
    const r = runModules(fin(bankHtml))
    expect(metric(r, 'nii').value).toBe(300 * M)
    expect(metric(r, 'nim').value).toBeCloseTo(300 / 2000)
    expect(metric(r, 'efficiency').value).toBeCloseTo(280 / 500)
    expect(metric(r, 'nonint-share').value).toBeCloseTo(200 / 500)
    expect(metric(r, 'provision-rev').value).toBeCloseTo(20 / 500)
    expect(metric(r, 'loans-deposits').value).toBeCloseTo(900 / 1500)
    expect(metric(r, 'equity-assets').value).toBeCloseTo(1100 / 2000)
  })
  it('does not invent industrial ratios for a bank', () => {
    const noOi = bankHtml
      .replace('us-gaap:OperatingIncomeLoss', 'us-gaap:SomethingElse')
      .replace(/<ix:nonFraction name="us-gaap:CostOfGoodsAndServicesSold"[^<]*<\/ix:nonFraction>/g, '')
      .replace('</body>', '<ix:nonFraction name="us-gaap:IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest" contextRef="FY24" unitRef="usd" decimals="-6" scale="6">190</ix:nonFraction></body>')
    const f = fin(noOi)
    expect(f.cur.operatingIncome).toBeUndefined()
    expect(f.cur.interestExpense).toBeUndefined()
    expect(f.bsCur.debt).toBeUndefined()
    const r = runModules(f)
    expect(metric(r, 'operating-margin').value).toBeNull()
    expect(metric(r, 'debt-equity').value).toBeNull()
    expect(metric(r, 'efficiency').value).toBeCloseTo(280 / 500)
  })
  it('produces nothing for a non-bank', () => {
    const r = runModules(fin())
    expect(r.bank.metrics.every((m) => m.value === null)).toBe(true)
  })
})

describe('EBITDA margin', () => {
  it('works without gross profit and feeds the industry comparison', () => {
    const noCogs = buildFixture().replace(/<ix:nonFraction name="us-gaap:CostOfGoodsAndServicesSold"[^<]*<\/ix:nonFraction>/g, '')
    const industry: IndustryBenchmark = { name: 'X', asOf: '2026-01-05', firms: 5, values: { ebitdaMargin: 0.1, grossMargin: 0.3 } }
    const r = runModules({ ...fin(noCogs), industry })
    expect(metric(r, 'gross-margin').value).toBeNull()
    expect(metric(r, 'ebitda-margin').value).toBeCloseTo((200 + 30) / 1000)
    expect(r.industry.metrics.find((m) => m.id === 'ind-ebitda-margin')?.compare).toMatchObject({ flag: 'Above', read: 'Favorable' })
  })
})
