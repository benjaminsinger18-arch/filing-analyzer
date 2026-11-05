export type Unit = 'pct' | 'weeks'

export type Benchmark = {
  id: string
  metric: string
  value: number | null
  unit: Unit
  year: number
  source: string
  sample: string
  status: 'Unverified' | 'Re-confirm' | 'No source'
  link: string
  note: string
}

const ICONIQ = 'ICONIQ State of GTM 2026 (via SaaStr)'
const ICONIQ_N = '150+ B2B GTM execs, Jan 2026'
const ICONIQ_L = 'https://www.iconiq.com/growth/insights/the-state-of-go-to-market-in-2026'
const SC_B = 'https://www.saas-capital.com/blog-posts/benchmarking-metrics-for-bootstrapped-saas-companies/'
const SC_G = 'https://www.saas-capital.com/research/private-saas-company-growth-rate-benchmarks/'

export const benchmarks: Benchmark[] = [
  { id: 'trial26', metric: 'Free trial / POC conversion to paid', value: 0.5, unit: 'pct', year: 2026, source: ICONIQ, sample: ICONIQ_N, status: 'Unverified', link: ICONIQ_L, note: 'Up 14 pts YoY per SaaStr. Original report is gated.' },
  { id: 'trial25', metric: 'Free trial / POC conversion to paid', value: 0.36, unit: 'pct', year: 2025, source: ICONIQ, sample: ICONIQ_N, status: 'Unverified', link: ICONIQ_L, note: 'Implied by the +14 pt change.' },
  { id: 'cycle26', metric: 'Average sales cycle length', value: 19, unit: 'weeks', year: 2026, source: ICONIQ, sample: ICONIQ_N, status: 'Unverified', link: ICONIQ_L, note: 'SaaStr labels 25 to 19 weeks as H1 2025 to H2 2025; the brief says 2025 to 2026. Check the original.' },
  { id: 'cycle25', metric: 'Average sales cycle length', value: 25, unit: 'weeks', year: 2025, source: ICONIQ, sample: ICONIQ_N, status: 'Unverified', link: ICONIQ_L, note: 'See period-label note.' },
  { id: 'sub126', metric: 'Sub-one-year contracts, share of new logos', value: 0.13, unit: 'pct', year: 2026, source: ICONIQ, sample: ICONIQ_N, status: 'Unverified', link: ICONIQ_L, note: '' },
  { id: 'sub123', metric: 'Sub-one-year contracts, share of new logos', value: 0.04, unit: 'pct', year: 2023, source: ICONIQ, sample: ICONIQ_N, status: 'Unverified', link: ICONIQ_L, note: '' },
  { id: 'three26', metric: 'Three-year contracts, share of new logos', value: 0.23, unit: 'pct', year: 2026, source: ICONIQ, sample: ICONIQ_N, status: 'Unverified', link: ICONIQ_L, note: '' },
  { id: 'three23', metric: 'Three-year contracts, share of new logos', value: 0.28, unit: 'pct', year: 2023, source: ICONIQ, sample: ICONIQ_N, status: 'Unverified', link: ICONIQ_L, note: '' },
  { id: 'nnrr26', metric: 'AE comp: companies using net new recurring revenue', value: 0.33, unit: 'pct', year: 2026, source: ICONIQ, sample: ICONIQ_N, status: 'Unverified', link: ICONIQ_L, note: '' },
  { id: 'nnrr25', metric: 'AE comp: companies using net new recurring revenue', value: 0.25, unit: 'pct', year: 2025, source: ICONIQ, sample: ICONIQ_N, status: 'Unverified', link: ICONIQ_L, note: '' },
  { id: 'ndr26', metric: 'AE comp: companies using NRR / NDR as a metric', value: null, unit: 'pct', year: 2026, source: ICONIQ, sample: ICONIQ_N, status: 'No source', link: ICONIQ_L, note: 'no source: only a +5 pt rise reported; levels not found.' },
  { id: 'nrr26', metric: 'Net revenue retention (median), bootstrapped $3M-$20M ARR', value: 1.03, unit: 'pct', year: 2026, source: 'SaaS Capital bootstrapped benchmarks', sample: '1,000+ private B2B SaaS (subset n not stated)', status: 'Re-confirm', link: SC_B, note: 'Bootstrapped/private population; weak peer match. Third source added by user choice.' },
  { id: 'growth25', metric: 'ARR growth (median), all companies in survey', value: 0.22, unit: 'pct', year: 2025, source: 'SaaS Capital growth benchmarks', sample: '1,000+ private B2B SaaS', status: 'Re-confirm', link: SC_G, note: 'Overall median, not a $20M ARR band.' },
  { id: 'win', metric: 'Win rate', value: null, unit: 'pct', year: 2026, source: 'None of the listed sources', sample: 'n/a', status: 'No source', link: '', note: 'no source' },
  { id: 'level', metric: 'Level Equity 2026: requested GTM metrics', value: null, unit: 'pct', year: 2026, source: 'Level Equity 2026 GTM Insights', sample: 'Not stated', status: 'No source', link: 'https://www.levelequity.com/report/go-to-market-insights-2026/', note: 'no source: page text is directional only; figures may sit in chart images.' },
]

export const assumptions: { metric: string; display: string; note: string }[] = [
  { metric: 'ARR', display: '$20,000,000', note: 'No benchmark used' },
  { metric: 'ARR growth (YoY)', display: '35%', note: 'SaaS Capital median growth' },
  { metric: 'Net revenue retention', display: '105%', note: 'SaaS Capital median NRR' },
  { metric: 'Average deal size (ACV)', display: '$60,000', note: 'No benchmark used' },
  { metric: 'Win rate', display: '22%', note: 'No source' },
  { metric: 'Sales cycle', display: '25 weeks', note: 'ICONIQ (unverified)' },
  { metric: 'Free trial / POC conversion', display: '30%', note: 'ICONIQ (unverified)' },
  { metric: 'Pricing model', display: 'Seat-based subscription', note: 'n/a' },
  { metric: 'Average contract term (new logos)', display: '3 years', note: 'Not comparable: benchmark is a share of logos' },
]

type ScoredDef = {
  id: string
  label: string
  unit: Unit
  company: number
  benchmarkId: string
  higherIsBetter: boolean
  source: string
}

const scoredDefs: ScoredDef[] = [
  { id: 'trial', label: 'Trial / POC conversion', unit: 'pct', company: 0.3, benchmarkId: 'trial26', higherIsBetter: true, source: 'ICONIQ 2026 (unverified)' },
  { id: 'nrr', label: 'Net revenue retention', unit: 'pct', company: 1.05, benchmarkId: 'nrr26', higherIsBetter: true, source: 'SaaS Capital 2026' },
  { id: 'growth', label: 'ARR growth (YoY)', unit: 'pct', company: 0.35, benchmarkId: 'growth25', higherIsBetter: true, source: 'SaaS Capital (2025 data)' },
  { id: 'cycle', label: 'Sales cycle', unit: 'weeks', company: 25, benchmarkId: 'cycle26', higherIsBetter: false, source: 'ICONIQ 2026 (unverified)' },
]

export type Flag = 'Above' | 'At' | 'Below'
export type Read = 'Favorable' | 'Unfavorable' | 'On par'
export const TOLERANCE = 0.1

export type ScoredMetric = ScoredDef & {
  benchmark: number
  gap: number
  gapPct: number
  index: number
  flag: Flag
  read: Read
}

export const scored: ScoredMetric[] = scoredDefs.map((d) => {
  const benchmark = benchmarks.find((b) => b.id === d.benchmarkId)!.value as number
  const gap = d.company - benchmark
  const index = d.company / benchmark
  const flag: Flag = Math.abs(index - 1) <= TOLERANCE ? 'At' : index > 1 ? 'Above' : 'Below'
  const read: Read =
    flag === 'At' ? 'On par' : (flag === 'Above') === d.higherIsBetter ? 'Favorable' : 'Unfavorable'
  return { ...d, benchmark, gap, gapPct: gap / benchmark, index, flag, read }
})

export const ranked = [...scored].sort(
  (a, b) => Math.abs(b.index - 1) - Math.abs(a.index - 1),
)

export const notScored = [
  { label: 'Win rate', why: 'No source' },
  { label: 'New-logo contract mix (<1 yr / 3 yr share)', why: 'Company has avg term only' },
  { label: 'AE comp: NNRR / NRR / NDR', why: 'No company value' },
]

export function fmt(value: number, unit: Unit, signed = false) {
  const sign = signed && value > 0 ? '+' : ''
  if (unit === 'pct') return `${sign}${Math.round(value * 100)}${signed ? ' pts' : '%'}`
  return `${sign}${value} wks`
}

export const gapTests = [
  {
    title: 'Trial / POC conversion',
    gap: '30% vs ~50% (index 0.60, Below)',
    cause:
      'May reflect weak qualification before trials, slow time-to-value, or seat-based pricing needing multi-user adoption.',
    test: 'Randomize inbound trials 50/50 for 8-10 weeks: qualification checklist plus guided onboarding to activate seats 2-3.',
    success: 'Trial-to-paid within 60 days at 40% or more in the test arm, ACV not more than 10% lower.',
  },
  {
    title: 'Sales cycle',
    gap: '25 vs ~19 weeks (index 1.32, Above)',
    cause:
      'Could reflect multi-stakeholder buying at $60K ACV, late security/legal review, or 3-year term negotiation.',
    test: 'For one quarter, start security review and paper at stage two with a mutual action plan; compare to matched opportunities.',
    success: 'Median cycle of 21 weeks or less, win rate no lower than 22%.',
  },
]

export const limits = [
  'Stage and ACV: cycle length varies widely by deal size, so a blended average says little about a $60K ACV business.',
  'Segment and motion: the trial/POC figure may mix product-led and sales-led motions.',
  'Sample bias: 150+ self-selected executives; SaaS Capital covers private, largely bootstrapped companies.',
  'Source quality: every ICONIQ value comes from a secondary summary and has a period-label conflict.',
]
