import type { AnalysisModule, ModuleResult, RatingCategory, RatingResult } from './types'

/**
 * Screening rubric. Every metric maps to a 0-100 tier score through the tables below; a category is
 * the mean of its available metric scores; the composite is the mean of available categories.
 * It is a transparent rules-based screen, not a recommendation to buy, sell or hold anything.
 */
export const RUBRIC_TABLES: Record<string, { label: string; tiers: [number, number][]; floor: number; pct?: boolean }> = {
  'operating-margin': { label: 'Operating margin', tiers: [[0.25, 100], [0.15, 80], [0.08, 60], [0, 35]], floor: 10, pct: true },
  roa: { label: 'Return on assets', tiers: [[0.1, 100], [0.05, 75], [0.02, 50], [0, 30]], floor: 10, pct: true },
  'current-ratio': { label: 'Current ratio', tiers: [[2, 100], [1.5, 80], [1, 55]], floor: 25 },
  'liabilities-assets': { label: 'Liabilities / assets (lower is better)', tiers: [], floor: 0 },
  'interest-coverage': { label: 'Interest coverage', tiers: [[10, 100], [5, 80], [2, 55], [1, 30]], floor: 10 },
  'ocf-ni': { label: 'OCF / net income', tiers: [[1.1, 100], [0.9, 80], [0.6, 55], [0.0001, 35]], floor: 10 },
  'fcf-margin': { label: 'FCF margin', tiers: [[0.15, 100], [0.08, 80], [0.03, 60], [0, 40]], floor: 10, pct: true },
  'rev-growth': { label: 'Revenue growth', tiers: [[0.2, 100], [0.1, 80], [0.03, 60], [0, 40]], floor: 15, pct: true },
  'oi-growth': { label: 'Operating income growth', tiers: [[0.2, 100], [0.1, 80], [0.03, 60], [0, 40]], floor: 15, pct: true },
  piotroski: { label: 'Piotroski F-score', tiers: [[8, 100], [6, 75], [4, 50], [2, 30]], floor: 10 },
}

function tierScore(id: string, value: number): number {
  if (id === 'liabilities-assets') return value <= 0.4 ? 100 : value <= 0.6 ? 75 : value <= 0.8 ? 50 : 25
  const t = RUBRIC_TABLES[id]
  for (const [min, score] of t.tiers) if (value >= min) return score
  return t.floor
}

const CATEGORIES: { id: string; label: string; metrics: string[] }[] = [
  { id: 'profitability', label: 'Profitability', metrics: ['operating-margin', 'roa'] },
  { id: 'balance', label: 'Balance sheet', metrics: ['current-ratio', 'liabilities-assets', 'interest-coverage'] },
  { id: 'cash', label: 'Cash flow', metrics: ['ocf-ni', 'fcf-margin'] },
  { id: 'growth', label: 'Growth', metrics: ['rev-growth', 'oi-growth'] },
  { id: 'quality', label: 'Quality & distress', metrics: ['piotroski', 'altman'] },
]

const fmtVal = (id: string, v: number) => (id === 'piotroski' ? `${v} / 9` : RUBRIC_TABLES[id]?.pct || id === 'liabilities-assets' ? `${(v * 100).toFixed(1)}%` : v.toFixed(2))

export function computeRating(results: Record<string, ModuleResult>): RatingResult {
  const all = Object.values(results).flatMap((r) => r.metrics)
  const get = (id: string) => all.find((m) => m.id === id)
  const categories: RatingCategory[] = CATEGORIES.map((c) => {
    const parts: { score: number; text: string }[] = []
    for (const id of c.metrics) {
      const m = get(id)
      if (!m || m.value === null) continue
      if (id === 'altman') {
        const s = m.value > 2.6 ? 100 : m.value >= 1.1 ? 55 : 10
        parts.push({ score: s, text: `Altman Z'' ${m.value.toFixed(2)} -> ${s}` })
      } else {
        const s = tierScore(id, m.value)
        parts.push({ score: s, text: `${RUBRIC_TABLES[id].label} ${fmtVal(id, m.value)} -> ${s}` })
      }
    }
    return {
      id: c.id,
      label: c.label,
      score: parts.length ? parts.reduce((a, p) => a + p.score, 0) / parts.length : null,
      basis: parts.map((p) => p.text),
    }
  })
  const used = categories.filter((c) => c.score !== null)
  const composite = used.length >= 2 ? used.reduce((a, c) => a + (c.score as number), 0) / used.length : null
  const tier: RatingResult['tier'] =
    composite === null ? 'Insufficient data' : composite >= 75 ? 'Strong' : composite >= 60 ? 'Solid' : composite >= 45 ? 'Mixed' : 'Weak'
  return { composite, tier, categories, used: used.length, total: categories.length }
}

export const rating: AnalysisModule = {
  id: 'rating',
  title: 'Screening rating',
  description: 'Composite of the other modules using a published rubric. A screen, not advice.',
  requires: [],
  run(_fin, prior) {
    const r = computeRating(prior)
    return {
      id: 'rating',
      title: 'Screening rating',
      metrics: [],
      notes: [],
      rating: r,
    }
  },
}
