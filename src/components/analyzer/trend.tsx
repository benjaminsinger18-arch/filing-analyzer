import { useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Financials } from '@/lib/financials'
import { RATIO_MODULES } from '@/modules/registry'
import type { Metric, ModuleResult } from '@/modules/types'
import { formatMetric } from './format'
import { Panel } from './ui'

const SKIP = new Set(['industry', 'market', 'valuation'])

export type Series = { f: Financials; r: Record<string, ModuleResult> }[]

/** Filings of the same company and form as `fin`, oldest first, with their module results. */
export function seriesFor(fin: Financials, history: Financials[], results: Map<Financials, Record<string, ModuleResult>>): Series {
  return history
    .filter((h) => h.meta.name === fin.meta.name && h.meta.form === fin.meta.form)
    .sort((a, b) => a.meta.periodEnd.localeCompare(b.meta.periodEnd))
    .flatMap((f) => {
      const r = results.get(f)
      return r ? [{ f, r }] : []
    })
}

export function TrendPanel({ series }: { series: Series }) {
  const [pick, setPick] = useState('')
  if (series.length < 2) return null
  // Metrics with a value in at least two of the filings.
  const options: Metric[] = []
  for (const mod of RATIO_MODULES) {
    if (SKIP.has(mod.id)) continue
    for (const m of series[series.length - 1].r[mod.id]?.metrics ?? []) {
      const n = series.filter(({ r }) => r[mod.id]?.metrics.find((x) => x.id === m.id)?.value != null).length
      if (n >= 2) options.push(m)
    }
  }
  if (!options.length) return null
  const sel = options.find((m) => m.id === pick) ?? options.find((m) => m.id === 'operating-margin') ?? options[0]
  const data = series.flatMap(({ f, r }) => {
    const m = Object.values(r).flatMap((x) => x.metrics).find((x) => x.id === sel.id)
    return m && m.value !== null ? [{ period: f.meta.periodEnd, value: m.value }] : []
  })
  const fmt = (v: number) => formatMetric({ ...sel, value: v })
  return (
    <Panel
      title="Trend"
      className="shrink-0"
      right={
        <select value={sel.id} onChange={(e) => setPick(e.target.value)} aria-label="Trend metric" className="h-6 max-w-48 px-1 text-[11px]">
          {options.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
      }
    >
      <div className="h-56 px-2 pb-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 12, right: 16, bottom: 0, left: 4 }}>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis dataKey="period" tick={{ fontSize: 11, fill: 'var(--muted)' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} tickLine={false} axisLine={false} tickFormatter={fmt} width={64} domain={['auto', 'auto']} />
            <Tooltip formatter={(v) => fmt(Number(v))} contentStyle={{ background: 'var(--panel)', border: '1px solid var(--line)', fontSize: 12 }} />
            <Line type="monotone" dataKey="value" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3, fill: 'var(--accent)' }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  )
}
