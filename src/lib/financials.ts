export type LineItem =
  | 'revenue'
  | 'cogs'
  | 'grossProfit'
  | 'operatingIncome'
  | 'pretaxIncome'
  | 'incomeTax'
  | 'netIncome'
  | 'epsDiluted'
  | 'interestExpense'
  | 'da'
  | 'ocf'
  | 'capex'
  | 'dilutedShares'
  | 'dividends'
  | 'netInterestIncome'
  | 'nonInterestIncome'
  | 'nonInterestExpense'
  | 'provision'
  | 'deposits'
  | 'loans'
  | 'assets'
  | 'currentAssets'
  | 'cash'
  | 'receivables'
  | 'inventory'
  | 'liabilities'
  | 'currentLiabilities'
  | 'payables'
  | 'debt'
  | 'equity'
  | 'retainedEarnings'

export type MarketRatios = {
  pe?: number
  forwardPe?: number
  peg?: number
  evEbitda?: number
  evRevenue?: number
  pb?: number
  beta?: number
  dividendYield?: number
  marketCap?: number
}

/** Provider-reported market data (Alpha Vantage), fetched on demand. */
export type MarketData = {
  ticker: string
  price: number
  priceAsOf: string | null
  source: string
  ratios: MarketRatios
  sector?: string
  industry?: string
  /** Set when ratios could not be fetched (missing key, rate limit). */
  ratiosNote?: string
  /** Provider-computed fundamentals (TTM), used only to fill ratios the filing cannot produce. Percent values are fractions. */
  fundamentals?: Record<string, number>
}

/** One Damodaran industry row (US, annual aggregates). Percent-like values are fractions. */
export type IndustryBenchmark = {
  name: string
  asOf: string
  firms: number
  values: Record<string, number | null>
  /** Broad-market row (Damodaran total market) used as a second benchmark and as a fallback. */
  market?: { name: string; firms: number; values: Record<string, number | null> }
}

/** A value with the XBRL tag it came from, for the audit trail. */
export type Value = { value: number; tag: string }

export type Items = Partial<Record<LineItem, Value>>

export type FilingMeta = {
  name: string
  ticker?: string
  cik?: string
  form: string
  fiscalPeriod: string
  periodEnd: string
  sourceUrl?: string
}

export type Financials = {
  meta: FilingMeta
  basis: 'annual' | 'quarter'
  /** Multiply a period flow by this to annualize (1 for 10-K, 4 for 10-Q). */
  annualFactor: number
  /** Income-statement flows for the filing period (quarter for a 10-Q) and the same period a year earlier. */
  cur: Items
  prior: Items
  /** Year-to-date flows (equal to cur/prior for a 10-K). Cash-flow items are only available here. */
  ytd: Items
  ytdPrior: Items
  /** Balance sheet at period end and at the comparison date (prior year-end). */
  bsCur: Items
  bsPrior: Items
  /** Optional user-entered share price for valuation ratios. */
  price?: number
  /** Date of the entered or fetched price (ISO), shown next to valuation ratios. */
  priceAsOf?: string
  market?: MarketData
  industry?: IndustryBenchmark
}

export const LINE_ITEM_LABELS: Record<LineItem, string> = {
  revenue: 'Revenue',
  cogs: 'Cost of revenue',
  grossProfit: 'Gross profit',
  operatingIncome: 'Operating income',
  pretaxIncome: 'Pre-tax income',
  incomeTax: 'Income tax expense',
  netIncome: 'Net income',
  epsDiluted: 'Diluted EPS',
  interestExpense: 'Interest expense',
  da: 'Depreciation & amortization',
  ocf: 'Operating cash flow',
  capex: 'Capital expenditures',
  dilutedShares: 'Diluted weighted shares',
  dividends: 'Dividends paid',
  netInterestIncome: 'Net interest income',
  nonInterestIncome: 'Noninterest income',
  nonInterestExpense: 'Noninterest expense',
  provision: 'Provision for credit losses',
  deposits: 'Deposits',
  loans: 'Loans',
  assets: 'Total assets',
  currentAssets: 'Current assets',
  cash: 'Cash & equivalents',
  receivables: 'Receivables',
  inventory: 'Inventory',
  liabilities: 'Total liabilities',
  currentLiabilities: 'Current liabilities',
  payables: 'Accounts payable',
  debt: 'Total debt',
  equity: "Stockholders' equity",
  retainedEarnings: 'Retained earnings',
}
