import type { Metric } from '@/modules/types'
import { formatMetric } from './format'

const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)

/** CSV of the ratio table: module, metric, value, raw value, formula, source. */
export function ratiosCsv(rows: { moduleTitle: string; m: Metric }[]): string {
  const lines = [['Module', 'Metric', 'Value', 'Raw', 'Formula', 'Source'].join(',')]
  for (const { moduleTitle, m } of rows) {
    lines.push([moduleTitle, m.label, formatMetric(m), String(m.value), m.formula, m.source === 'provider' ? 'Finnhub, TTM' : 'Filing'].map(cell).join(','))
  }
  return lines.join('\n')
}

export function downloadCsv(name: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}
