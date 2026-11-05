import type { Financials, LineItem, Value } from '@/lib/financials'

/** '%' values are stored as fractions (0.25 = 25%). */
export type Unit = 'x' | '%' | 'days' | 'usd' | 'score' | 'pts'

export type MetricInput = { label: string; value: number; tag: string }

export type Metric = {
  id: string
  label: string
  value: number | null
  unit: Unit
  formula: string
  inputs: MetricInput[]
  /** Why value is null, or a short caveat. */
  reason?: string
  hint?: string
}

export type Note = { tone: 'good' | 'watch' | 'info'; text: string }

export type ModuleResult = {
  id: string
  title: string
  metrics: Metric[]
  notes: Note[]
  /** Set by the rating module only. */
  rating?: RatingResult
}

export type RatingCategory = {
  id: string
  label: string
  score: number | null
  /** What fed the score, e.g. "Operating margin 18% -> 80". */
  basis: string[]
}

export type RatingResult = {
  composite: number | null
  tier: 'Strong' | 'Solid' | 'Mixed' | 'Weak' | 'Insufficient data'
  categories: RatingCategory[]
  used: number
  total: number
}

export type AnalysisModule = {
  id: string
  title: string
  description: string
  requires: LineItem[]
  run(fin: Financials, prior: Record<string, ModuleResult>): ModuleResult
}

export type InputMap = Record<string, Value | undefined>
