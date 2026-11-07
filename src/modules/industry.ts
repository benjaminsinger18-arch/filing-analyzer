import type { AnalysisModule, Comparison, Metric, ModuleResult, Note, Unit } from './types'

type Direction = 'higher' | 'lower' | 'neutral'

type Spec = {
  id: string
  label: string
  unit: Unit
  /** Metric id in the earlier modules, or a function building the company value. */
  source: string
  /** Key in the Damodaran industry row. */
  key: string
  direction: Direction
  formula: string
}

const SPECS: Spec[] = [
  { id: 'ind-gross-margin', label: 'Gross margin', unit: '%', source: 'gross-margin', key: 'grossMargin', direction: 'higher', formula: 'Company vs. industry gross margin' },
  { id: 'ind-operating-margin', label: 'Operating margin', unit: '%', source: 'operating-margin', key: 'operatingMargin', direction: 'higher', formula: 'Pre-tax unadjusted operating margin' },
  { id: 'ind-net-margin', label: 'Net margin', unit: '%', source: 'net-margin', key: 'netMargin', direction: 'higher', formula: 'Company vs. industry net margin' },
  { id: 'ind-roe', label: 'Return on equity', unit: '%', source: 'roe', key: 'roe', direction: 'higher', formula: 'Net income / equity (unadjusted)' },
  { id: 'ind-debt-capital', label: 'Debt / capital (book)', unit: '%', source: 'debt-capital', key: 'bookDebtToCapital', direction: 'lower', formula: 'Debt / (debt + equity), book values' },
  { id: 'ind-interest-coverage', label: 'Interest coverage', unit: 'x', source: 'interest-coverage', key: 'interestCoverage', direction: 'higher', formula: 'Operating income / interest expense' },
  { id: 'ind-debt-ebitda', label: 'Debt / EBITDA', unit: 'x', source: 'debt-ebitda', key: 'debtToEbitda', direction: 'lower', formula: 'Total debt / EBITDA' },
  { id: 'ind-pe', label: 'P/E', unit: 'x', source: 'pe', key: 'pe', direction: 'neutral', formula: 'Price / diluted EPS vs. industry current P/E' },
  { id: 'ind-pb', label: 'P/B', unit: 'x', source: 'pb', key: 'pb', direction: 'neutral', formula: "Market cap / equity vs. industry price-to-book" },
  { id: 'ind-ev-ebitda', label: 'EV / EBITDA', unit: 'x', source: 'ev-ebitda', key: 'evEbitda', direction: 'neutral', formula: 'Positive-EBITDA firms only' },
  { id: 'ind-ev-sales', label: 'EV / sales', unit: 'x', source: 'ev-sales', key: 'evSales', direction: 'neutral', formula: 'Enterprise value / revenue' },
]

const TOLERANCE = 0.1

export function compare(company: number, industry: number, direction: Direction, name: string): Comparison {
  if (industry <= 0) return { industry, industryName: name, deltaPct: null, flag: 'n/a', read: 'n/a' }
  const index = company / industry
  const flag = Math.abs(index - 1) <= TOLERANCE ? 'At' : index > 1 ? 'Above' : 'Below'
  const read =
    flag === 'At' ? 'On par' : direction === 'neutral' ? 'Neutral' : (flag === 'Above') === (direction === 'higher') ? 'Favorable' : 'Unfavorable'
  return { industry, industryName: name, deltaPct: index - 1, flag, read }
}

export const industry: AnalysisModule = {
  id: 'industry',
  title: 'Industry comparison',
  description: 'Company vs. Damodaran US industry averages.',
  requires: [],
  run(fin, prior) {
    const ind = fin.industry
    if (!ind) {
      return {
        id: 'industry',
        title: 'Industry comparison',
        metrics: [],
        notes: [{ tone: 'info', text: 'No industry matched. Pick one to compare.' }],
      }
    }
    const all = Object.values(prior).flatMap((r: ModuleResult) => r.metrics)
    const val = (id: string) => all.find((m) => m.id === id)?.value ?? null
    // Debt / capital is not a standalone metric elsewhere; build it from the balance sheet.
    const debt = fin.bsCur.debt?.value
    const equity = fin.bsCur.equity?.value
    const debtCapital = debt !== undefined && equity !== undefined && debt + equity > 0 ? debt / (debt + equity) : null

    const metrics: Metric[] = SPECS.map((s) => {
      const company = s.source === 'debt-capital' ? debtCapital : val(s.source)
      const benchmark = ind.values[s.key]
      const base = { id: s.id, label: s.label, unit: s.unit, formula: s.formula, inputs: [] }
      if (benchmark === null || benchmark === undefined) return { ...base, value: company, reason: 'No industry figure' }
      if (company === null) return { ...base, value: null, reason: 'Company value n/a (see ratios)' }
      return { ...base, value: company, compare: compare(company, benchmark, s.direction, ind.name) }
    })

    const directional = metrics.filter((m) => m.compare && m.compare.read !== 'Neutral' && m.compare.read !== 'n/a')
    const better = directional.filter((m) => m.compare!.read === 'Favorable').length
    const worse = directional.filter((m) => m.compare!.read === 'Unfavorable').length
    const notes: Note[] = [
      {
        tone: 'info',
        text: directional.length
          ? `${ind.name} (${ind.firms} firms, ${ind.asOf.slice(0, 7)}): ${better} of ${directional.length} comparable metrics are better than the industry average, ${worse} are worse.`
          : `${ind.name} (${ind.firms} firms, ${ind.asOf.slice(0, 7)}): no comparable metrics available.`,
      },
    ]
    if (/bank|insurance|brokerage|financial/i.test(ind.name)) {
      notes.push({ tone: 'info', text: 'Financial-sector filing: margin and EBITDA comparisons may not apply.' })
    }
    return { id: 'industry', title: 'Industry comparison', metrics, notes }
  },
}
