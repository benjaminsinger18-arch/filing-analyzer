import type { Financials, Items, LineItem, Value } from '../financials'
import type { ParsedFiling, Period } from './parse'

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
  interestExpense: ['InterestExpense', 'InterestExpenseDebt', 'InterestExpenseNonoperating', 'InterestAndDebtExpense'],
  dilutedShares: ['WeightedAverageNumberOfDilutedSharesOutstanding'],
}

/** Cash-flow items only exist as year-to-date figures. */
export const CASHFLOW_TAGS: Partial<Record<LineItem, string[]>> = {
  da: ['DepreciationDepletionAndAmortization', 'DepreciationAndAmortization', 'DepreciationAmortizationAndAccretionNet'],
  ocf: ['NetCashProvidedByUsedInOperatingActivities', 'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations'],
  capex: ['PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsToAcquireProductiveAssets'],
}

export const STOCK_TAGS: Partial<Record<LineItem, string[]>> = {
  assets: ['Assets'],
  currentAssets: ['AssetsCurrent'],
  cash: ['CashAndCashEquivalentsAtCarryingValue', 'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents'],
  receivables: ['AccountsReceivableNetCurrent', 'ReceivablesNetCurrent'],
  inventory: ['InventoryNet'],
  liabilities: ['Liabilities'],
  currentLiabilities: ['LiabilitiesCurrent'],
  payables: ['AccountsPayableCurrent'],
  equity: ['StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'],
  retainedEarnings: ['RetainedEarningsAccumulatedDeficit'],
}

type Entry = { period: Period; value: number }

const DAY = 86_400_000
const days = (iso: string) => Date.parse(iso + 'T00:00:00Z') / DAY
const addDays = (iso: string, n: number) => new Date((days(iso) + n) * DAY).toISOString().slice(0, 10)

class FactIndex {
  private byTag = new Map<string, Entry[]>()

  constructor(parsed: ParsedFiling) {
    for (const f of parsed.facts) {
      if (!f.name.startsWith('us-gaap:')) continue
      const ctx = parsed.contexts[f.contextRef]
      if (!ctx || ctx.dimensional) continue
      const tag = f.name.slice('us-gaap:'.length)
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
  let noncurrent = idx.instant(['LongTermDebtNoncurrent', 'LongTermNotesPayable'], at)
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
      const parts = ['LongTermDebtCurrent', 'ShortTermBorrowings', 'CommercialPaper', 'NotesPayableCurrent']
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
      const v =
        mode2 === 'ytd'
          ? idx.flowLongest(order, end)
          : mode2 === 'annual'
            ? idx.flow(order, end, 340, 380)
            : idx.flow(order, end, 77, 105)
      if (v) out[item] = item === 'interestExpense' ? { ...v, value: Math.abs(v.value) } : v
    }
  }
  if (mode === 'ytd') {
    run(FLOW_TAGS, 'ytd')
    run(CASHFLOW_TAGS, 'ytd')
  } else {
    run(FLOW_TAGS, mode)
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

  let periodEnd = parsed.cover['dei:DocumentPeriodEndDate'] ?? ''
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
