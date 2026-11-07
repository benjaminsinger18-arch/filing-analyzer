import type { Metric, RatingResult } from '@/modules/types'

export function formatMetric(m: Metric): string {
  if (m.value === null) return 'n/a'
  const v = m.value
  switch (m.unit) {
    case '%': return `${(v * 100).toFixed(1)}%`
    case 'x': return `${v.toFixed(2)}x`
    case 'days': return `${Math.round(v)} d`
    case 'usd': return compactUsd(v)
    case 'score': return m.id === 'piotroski' ? `${v} / 9` : v.toFixed(2)
    default: return String(v)
  }
}

export const compactUsd = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 2 }).format(v)

// Middle scores (45-59) are plain: neutral text and a gray bar, so only green and red carry meaning.
export const scoreTone = (s: number | null) => (s === null ? 'text-(--muted)' : s >= 60 ? 'text-(--up)' : s >= 45 ? 'text-(--fg)' : 'text-(--down)')
export const scoreDepth = (s: number) => (s >= 60 ? 'var(--depth-up)' : s >= 45 ? 'color-mix(in srgb, var(--muted) 25%, transparent)' : 'var(--depth-down)')
export const tierTone: Record<RatingResult['tier'], string> = {
  Strong: 'bg-(--up-bg) text-(--up)',
  Solid: 'bg-(--up-bg) text-(--up)',
  Mixed: 'bg-(--warn-bg) text-(--warn)',
  Weak: 'bg-(--down-bg) text-(--down)',
  'Insufficient data': 'bg-(--panel-2) text-(--muted)',
}
