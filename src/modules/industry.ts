import type { AnalysisModule, CompareResult, Metric, ModuleResult, Note, Unit } from './types'
import type { MarketRatios } from '@/lib/financials'

/** Which side of the benchmark is favorable. Valuation multiples: a lower multiple than the average reads Favorable (cheaper). */
type Direction = 'higher' | 'lower'

type Spec = {
  id: string
  label: string
  unit: Unit
  /** Metric id in the earlier modules (or 'debt-capital', built here). */
  source: string
  /** Key in the Damodaran industry row. */
  key: string
  direction: Direction
  formula: string
  /** Provider ratio to use when the filing-based value cannot be computed. */
  provider?: keyof MarketRatios
}

const SPECS: Spec[] = [
  { id: 'ind-gross-margin', label: 'Gross margin', unit: '%', source: 'gross-margin', key: 'grossMargin', direction: 'higher', formula: 'Gross profit / revenue' },
  { id: 'ind-operating-margin', label: 'Operating margin', unit: '%', source: 'operating-margin', key: 'operatingMargin', direction: 'higher', formula: 'Pre-tax unadjusted operating margin' },
  { id: 'ind-net-margin', label: 'Net margin', unit: '%', source: 'net-margin', key: 'netMargin', direction: 'higher', formula: 'Net income / revenue' },
  { id: 'ind-roe', label: 'Return on equity', unit: '%', source: 'roe', key: 'roe', direction: 'higher', formula: 'Net income / equity (unadjusted)' },
  { id: 'ind-debt-capital', label: 'Debt / capital (book)', unit: '%', source: 'debt-capital', key: 'bookDebtToCapital', direction: 'lower', formula: 'Debt / (debt + equity), book values' },
  { id: 'ind-interest-coverage', label: 'Interest coverage', unit: 'x', source: 'interest-coverage', key: 'interestCoverage', direction: 'higher', formula: 'Operating income / interest expense' },
  { id: 'ind-debt-ebitda', label: 'Debt / EBITDA', unit: 'x', source: 'debt-ebitda', key: 'debtToEbitda', direction: 'lower', formula: 'Total debt / EBITDA' },
  { id: 'ind-pe', label: 'P/E', unit: 'x', source: 'pe', key: 'pe', direction: 'lower', formula: 'Price / diluted EPS vs. industry current P/E', provider: 'pe' },
  { id: 'ind-pb', label: 'P/B', unit: 'x', source: 'pb', key: 'pb', direction: 'lower', formula: 'Market cap / equity', provider: 'pb' },
  { id: 'ind-ev-ebitda', label: 'EV / EBITDA', unit: 'x', source: 'ev-ebitda', key: 'evEbitda', direction: 'lower', formula: 'Positive-EBITDA firms only', provider: 'evEbitda' },
  { id: 'ind-ev-sales', label: 'EV / sales', unit: 'x', source: 'ev-sales', key: 'evSales', direction: 'lower', formula: 'Enterprise value / revenue', provider: 'evRevenue' },
]

/** 'On par' (the only neutral read) means within 5% of the benchmark. */
const TOLERANCE = 0.05
/** For percent metrics against a non-positive benchmark: flag by points, at least this many. */
const MIN_POINTS = 0.01

/**
 * Compares a company value with a benchmark. Never returns a blank row for a usable benchmark:
 * - positive benchmark: relative difference with a +/-5% band
 * - non-positive benchmark on a percent metric: difference in percentage points
 * - non-positive benchmark on a multiple: n/a with a reason
 */
export function compare(company: number, benchmark: number | null, direction: Direction, isPct: boolean): CompareResult {
  if (benchmark === null || benchmark === undefined) {
    return { benchmark: NaN, deltaPct: null, deltaPts: null, flag: 'n/a', read: 'n/a', note: 'No benchmark figure' }
  }
  const deltaPts = isPct ? company - benchmark : null
  let flag: CompareResult['flag']
  let deltaPct: number | null = null
  let note: string | undefined
  if (benchmark > 0) {
    deltaPct = company / benchmark - 1
    flag = Math.abs(deltaPct) <= TOLERANCE ? 'At' : deltaPct > 0 ? 'Above' : 'Below'
  } else if (isPct) {
    const band = Math.max(MIN_POINTS, TOLERANCE * Math.abs(benchmark))
    flag = Math.abs(deltaPts!) <= band ? 'At' : deltaPts! > 0 ? 'Above' : 'Below'
    note = 'Negative average; compared in percentage points'
  } else {
    return { benchmark, deltaPct: null, deltaPts: null, flag: 'n/a', read: 'n/a', note: 'Average not meaningful (non-positive)' }
  }
  const read: CompareResult['read'] =
    flag === 'At' ? 'On par' : (flag === 'Above') === (direction === 'higher') ? 'Favorable' : 'Unfavorable'
  return { benchmark, deltaPct, deltaPts, flag, read, note }
}

export const industry: AnalysisModule = {
  id: 'industry',
  title: 'Industry comparison',
  description: 'Company vs. Damodaran US industry and market averages.',
  requires: [],
  run(fin, prior) {
    const ind = fin.industry
    if (!ind) {
      return {
        id: 'industry',
        title: 'Industry comparison',
        metrics: [],
        notes: [{ tone: 'info', text: 'No industry matched. Pick one.' }],
      }
    }
    const all = Object.values(prior).flatMap((r: ModuleResult) => r.metrics)
    const find = (id: string) => all.find((m) => m.id === id)
    // Debt / capital is not a standalone metric elsewhere; build it from the balance sheet.
    const debt = fin.bsCur.debt?.value
    const equity = fin.bsCur.equity?.value
    const debtCapital = debt !== undefined && equity !== undefined && debt + equity > 0 ? debt / (debt + equity) : null

    const metrics: Metric[] = SPECS.map((s) => {
      let company: number | null
      let missingWhy: string | undefined
      if (s.source === 'debt-capital') {
        company = debtCapital
        missingWhy = 'Not reported: debt or equity'
      } else {
        const m = find(s.source)
        company = m?.value ?? null
        missingWhy = m?.reason ?? (s.provider && !fin.price ? 'Needs a share price (click Fetch latest)' : undefined)
      }
      let companySource: string | undefined
      if (company === null && s.provider) {
        const p = fin.market?.ratios[s.provider]
        if (p !== undefined) {
          company = p
          companySource = 'provider'
        }
      }
      const base = { id: s.id, label: s.label, unit: s.unit, formula: s.formula, inputs: [] as Metric['inputs'] }
      if (company === null) {
        return { ...base, value: null, reason: missingWhy ?? 'Company value not available' }
      }
      const isPct = s.unit === '%'
      const own = compare(company, ind.values[s.key] ?? null, s.direction, isPct)
      const mk = ind.market ? compare(company, ind.market.values[s.key] ?? null, s.direction, isPct) : undefined
      return {
        ...base,
        value: company,
        compare: {
          ...own,
          industryName: ind.name,
          companySource,
          market: mk && ind.market ? { ...mk, name: ind.market.name } : undefined,
        },
      }
    })

    const directional = metrics.filter((m) => m.compare && m.compare.read !== 'On par' && m.compare.read !== 'n/a')
    const better = directional.filter((m) => m.compare!.read === 'Favorable').length
    const worse = directional.filter((m) => m.compare!.read === 'Unfavorable').length
    const notes: Note[] = [
      {
        tone: 'info',
        text: directional.length
          ? `${ind.name} (${ind.firms} firms, ${ind.asOf.slice(0, 7)}): ${better} of ${directional.length} comparable metrics better than the industry average, ${worse} worse.`
          : `${ind.name} (${ind.firms} firms, ${ind.asOf.slice(0, 7)}): no comparable metrics.`,
      },
    ]
    if (/bank|insurance|brokerage|financial/i.test(ind.name)) {
      notes.push({ tone: 'info', text: 'Financial filer: margin, coverage and EBITDA comparisons may not apply.' })
    }
    return { id: 'industry', title: 'Industry comparison', metrics, notes }
  },
}
