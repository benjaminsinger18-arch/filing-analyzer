import type { Financials, Items, LineItem, Value } from '../financials'
import { toIsoDate, type ParsedFiling, type Period } from './parse'

/** Ordered us-gaap tag fallbacks per income-statement / cash-flow item. */
export const FLOW_TAGS: Partial<Record<LineItem, string[]>> = {
  revenue: [
    'RevenueFromContractWithCustomerExcludingAssessedTax',
    'RevenueFromContractWithCustomerIncludingAssessedTax',
    'Revenues',
    'SalesRevenueNet',
    'SalesRevenueGoodsNet',
  ],
  cogs: ['CostOfGoodsAndServicesSold', 'CostOfRevenue', 'CostOfGoodsSold', 'CostOfServices'],
  grossProfit: ['GrossProfit'],
  operatingIncome: ['OperatingIncomeLoss'],
  pretaxIncome: [
    'IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest',
    'IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments',
  ],
  incomeTax: ['IncomeTaxExpenseBenefit'],
  netIncome: ['NetIncomeLoss', 'ProfitLoss', 'NetIncomeLossAvailableToCommonStockholdersBasic'],
  epsDiluted: ['EarningsPerShareDiluted'],
  // InterestPaid* (cash-flow supplemental) is a last-resort approximation of interest expense.
  interestExpense: ['InterestExpense', 'InterestExpenseDebt', 'InterestExpenseNonoperating', 'InterestAndDebtExpense', 'FinancingInterestExpense', 'InterestPaidNet', 'InterestPaid'],
  dilutedShares: ['WeightedAverageNumberOfDilutedSharesOutstanding'],
  // Banking
  netInterestIncome: ['InterestIncomeExpenseNet'],
  nonInterestIncome: ['NoninterestIncome'],
  nonInterestExpense: ['NoninterestExpense'],
  provision: ['ProvisionForLoanLeaseAndOtherLosses', 'ProvisionForCreditLosses', 'ProvisionForLoanAndLeaseLosses'],
}

/** Cash-flow items only exist as year-to-date figures. */
export const CASHFLOW_TAGS: Partial<Record<LineItem, string[]>> = {
  // 'ext:' tags are company-specific extensions (e.g. msft:DepreciationAmortizationAndOther), used only as a fallback.
  da: ['DepreciationDepletionAndAmortization', 'DepreciationAndAmortization', 'DepreciationAmortizationAndAccretionNet', 'DepreciationAmortizationAndImpairment', 'OtherDepreciationAndAmortization', 'ext:DepreciationAmortizationAndOther', 'ext:DepreciationAmortizationAndImpairment', 'ext:DepreciationAndAmortization'],
  dividends: ['PaymentsOfDividends', 'PaymentsOfDividendsCommonStock', 'PaymentsOfOrdinaryDividends'],
  ocf: ['NetCashProvidedByUsedInOperatingActivities', 'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations'],
  capex: ['PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsToAcquireProductiveAssets'],
}

export const STOCK_TAGS: Partial<Record<LineItem, string[]>> = {
  assets: ['Assets'],
  currentAssets: ['AssetsCurrent'],
  cash: ['CashAndCashEquivalentsAtCarryingValue', 'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents'],
  receivables: ['AccountsReceivableNetCurrent', 'ReceivablesNetCurrent', 'AccountsAndNotesReceivableNetCurrent'],
  inventory: ['InventoryNet'],
  liabilities: ['Liabilities'],
  currentLiabilities: ['LiabilitiesCurrent'],
  payables: ['AccountsPayableCurrent', 'AccountsPayableTradeCurrent', 'AccountsPayableAndAccruedLiabilitiesCurrent'],
  equity: ['StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'],
  retainedEarnings: ['RetainedEarningsAccumulatedDeficit'],
  deposits: ['Deposits'],
  loans: ['LoansAndLeasesReceivableNetReportedAmount', 'LoansAndLeasesReceivableNetOfDeferredIncome', 'ext:LoansAndLeasesReceivableNetOfDeferredIncome'],
}

type Entry = { period: Period; value: number }

const DAY = 86_400_000
const days = (iso: string) => Date.parse(iso + 'T00:00:00Z') / DAY
const addDays = (iso: string, n: number) => new Date((days(iso) + n) * DAY).toISOString().slice(0, 10)

class FactIndex {
  private byTag = new Map<string, Entry[]>()

  constructor(parsed: ParsedFiling) {
    for (const f of parsed.facts) {
      const [prefix, local] = f.name.split(':')
      if (!local || ['dei', 'srt', 'ifrs-full'].includes(prefix)) continue
      const ctx = parsed.contexts[f.contextRef]
      if (!ctx || ctx.dimensional) continue
      const tag = prefix === 'us-gaap' ? local : `ext:${local}`
      const list = this.byTag.get(tag) ?? []
      list.push({ period: ctx.period, value: f.value })
      this.byTag.set(tag, list)
    }
  }

  entries(tag: string): Entry[] {
    return this.byTag.get(tag) ?? []
  }

  /** Duration fact ending near `end` whose length is within [min, max] days. */
  flow(tags: string[], end: string, min: number, max: number, tol = 10): Value | undefined {
    for (const tag of tags) {
      const hit = this.entries(tag).find((e) => {
        const { start, end: e2 } = e.period
        if (!start || !e2) return false
        const len = days(e2) - days(start)
        return Math.abs(days(e2) - days(end)) <= tol && len >= min && len <= max
      })
      if (hit) return { value: hit.value, tag }
    }
    return undefined
  }

  /** Longest duration (<= 380 days) ending near `end`. */
  flowLongest(tags: string[], end: string, tol = 10): Value | undefined {
    for (const tag of tags) {
      let best: { len: number; value: number } | undefined
      for (const e of this.entries(tag)) {
        const { start, end: e2 } = e.period
        if (!start || !e2 || Math.abs(days(e2) - days(end)) > tol) continue
        const len = days(e2) - days(start)
        if (len <= 380 && (!best || len > best.len)) best = { len, value: e.value }
      }
      if (best) return { value: best.value, tag }
    }
    return undefined
  }

  instant(tags: string[], at: string, tol = 3): Value | undefined {
    for (const tag of tags) {
      const hit = this.entries(tag).find(
        (e) => e.period.instant && Math.abs(days(e.period.instant) - days(at)) <= tol,
      )
      if (hit) return { value: hit.value, tag }
    }
    return undefined
  }

  /** Latest instant at least `gap` days before `before` that has a value for any tag. */
  priorInstant(tags: string[], before: string, gap = 60): string | undefined {
    let best: string | undefined
    for (const tag of tags) {
      for (const e of this.entries(tag)) {
        const i = e.period.instant
        if (i && days(before) - days(i) >= gap && (!best || i > best)) best = i
      }
    }
    return best
  }
}

function pickDebt(idx: FactIndex, at: string): Value | undefined {
  let noncurrent = idx.instant(['LongTermDebtNoncurrent', 'LongTermNotesPayable', 'LongTermDebtAndCapitalLeaseObligations', 'ConvertibleNotesPayableNoncurrent', 'SeniorNotesNoncurrent', 'OtherLongTermDebtNoncurrent'], at)
  let skipCurrent = false
  if (!noncurrent) {
    const total = idx.instant(['LongTermDebt'], at)
    if (total) {
      noncurrent = total
      skipCurrent = true
    }
  }
  let current: Value | undefined
  if (!skipCurrent) {
    current = idx.instant(['DebtCurrent'], at)
    if (!current) {
      const parts = ['LongTermDebtCurrent', 'LongTermDebtAndCapitalLeaseObligationsCurrent', 'ShortTermBorrowings', 'OtherShortTermBorrowings', 'CommercialPaper', 'NotesAndLoansPayable', 'NotesPayableCurrent']
        .map((t) => idx.instant([t], at))
        .filter((v): v is Value => !!v)
      if (parts.length) {
        current = { value: parts.reduce((s, p) => s + p.value, 0), tag: parts.map((p) => p.tag).join(' + ') }
      }
    }
  }
  if (!noncurrent && !current) return undefined
  const parts = [noncurrent, current].filter((v): v is Value => !!v)
  return {
    value: parts.reduce((s, p) => s + p.value, 0),
    tag: parts.map((p) => p.tag).join(' + '),
  }
}

function pickStocks(idx: FactIndex, at: string): Items {
  const out: Items = {}
  for (const [item, tags] of Object.entries(STOCK_TAGS) as [LineItem, string[]][]) {
    const v = idx.instant(tags, at)
    if (v) out[item] = v
  }
  const debt = pickDebt(idx, at)
  if (debt) out.debt = debt
  if (!out.liabilities) {
    const tle = idx.instant(['LiabilitiesAndStockholdersEquity'], at)
    const eq = idx.instant(['StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'], at) ?? out.equity
    if (tle && eq) {
      out.liabilities = { value: tle.value - eq.value, tag: 'derived: LiabilitiesAndStockholdersEquity - equity' }
    }
  }
  return out
}

function pickFlows(
  idx: FactIndex,
  end: string,
  mode: 'annual' | 'quarter' | 'ytd',
  prefer: Items = {},
): Items {
  const out: Items = {}
  const run = (table: Partial<Record<LineItem, string[]>>, mode2: typeof mode) => {
    for (const [item, tags] of Object.entries(table) as [LineItem, string[]][]) {
      const order = prefer[item] ? [prefer[item]!.tag, ...tags.filter((t) => t !== prefer[item]!.tag)] : tags
      const pickFrom = (tagList: string[]) =>
        mode2 === 'ytd'
          ? idx.flowLongest(tagList, end)
          : mode2 === 'annual'
            ? idx.flow(tagList, end, 340, 380)
            : idx.flow(tagList, end, 77, 105)
      let v = pickFrom(order)
      // Total revenues (e.g. Walmart's membership income, Chevron's other income) beat the narrower contract-revenue line.
      if (item === 'revenue' && v && !prefer.revenue && v.tag !== 'Revenues') {
        const total = pickFrom(['Revenues'])
        if (total && total.value >= v.value) v = total
      }
      if (v) out[item] = item === 'interestExpense' ? { ...v, value: Math.abs(v.value) } : v
    }
  }
  if (mode === 'ytd') {
    run(FLOW_TAGS, 'ytd')
    run(CASHFLOW_TAGS, 'ytd')
  } else {
    run(FLOW_TAGS, mode)
  }
  if (!out.operatingIncome && out.pretaxIncome && out.interestExpense) {
    out.operatingIncome = {
      value: out.pretaxIncome.value + out.interestExpense.value,
      tag: 'derived: pre-tax income + interest expense (approx.)',
    }
  }
  if (!out.da && mode === 'ytd') {
    const dep = idx.flowLongest(['Depreciation'], end)
    const amort = idx.flowLongest(['AmortizationOfIntangibleAssets'], end)
    if (dep && amort) out.da = { value: dep.value + amort.value, tag: 'Depreciation + AmortizationOfIntangibleAssets' }
  }
  if (!out.grossProfit && out.revenue && out.cogs) {
    out.grossProfit = { value: out.revenue.value - out.cogs.value, tag: 'derived: revenue - cost of revenue' }
  }
  return out
}

export class NotIxbrlError extends Error {}

export function normalize(parsed: ParsedFiling, sourceUrl?: string): Financials {
  const idx = new FactIndex(parsed)
  const form = parsed.cover['dei:DocumentType'] ?? ''
  const basis: Financials['basis'] = form.toUpperCase().startsWith('10-K') ? 'annual' : 'quarter'

  let periodEnd = toIsoDate(parsed.cover['dei:DocumentPeriodEndDate'] ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(periodEnd)) {
    const ends = Object.values(parsed.contexts)
      .filter((c) => !c.dimensional)
      .map((c) => c.period.end ?? c.period.instant ?? '')
      .filter(Boolean)
      .sort()
    periodEnd = ends[ends.length - 1] ?? ''
  }
  if (!periodEnd) throw new NotIxbrlError('Could not determine the filing period end date.')

  const priorEnd = addDays(periodEnd, -365)
  const cur = pickFlows(idx, periodEnd, basis)
  const prior = pickFlows(idx, priorEnd, basis, cur)
  const ytd = basis === 'annual' ? { ...cur, ...pickFlows(idx, periodEnd, 'ytd', cur) } : pickFlows(idx, periodEnd, 'ytd')
  const ytdPrior =
    basis === 'annual' ? { ...prior, ...pickFlows(idx, priorEnd, 'ytd', prior) } : pickFlows(idx, priorEnd, 'ytd', ytd)

  const bsCur = pickStocks(idx, periodEnd)
  const priorInstant = idx.priorInstant(['Assets'], periodEnd)
  const bsPrior = priorInstant ? pickStocks(idx, priorInstant) : {}

  if (!bsCur.assets && !cur.revenue && !cur.netIncome) {
    throw new NotIxbrlError('No recognizable US GAAP financial data found in this filing.')
  }

  // Banks: operating income, interest coverage and debt ratios built for industrial companies are
  // misleading (interest is the business, borrowings are only part of funding), so drop the
  // approximations and leave those ratios to the banking module.
  if (cur.netInterestIncome && cur.nonInterestExpense && !cur.grossProfit) {
    for (const set of [cur, prior, ytd, ytdPrior]) {
      if (set.operatingIncome?.tag.startsWith('derived')) delete set.operatingIncome
      delete set.interestExpense
    }
    delete bsCur.debt
    delete bsPrior.debt
  }

  const cover = parsed.cover
  return {
    meta: {
      name: cover['dei:EntityRegistrantName'] ?? 'Unknown company',
      ticker: cover['dei:TradingSymbol'],
      cik: cover['dei:EntityCentralIndexKey'],
      form: form || 'Unknown form',
      fiscalPeriod: cover['dei:DocumentFiscalPeriodFocus'] ?? '',
      periodEnd,
      sourceUrl,
    },
    basis,
    annualFactor: basis === 'annual' ? 1 : 4,
    cur,
    prior,
    ytd,
    ytdPrior,
    bsCur,
    bsPrior,
  }
}
