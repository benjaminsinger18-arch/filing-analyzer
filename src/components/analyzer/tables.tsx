import { Fragment, useState } from 'react'
import { RUBRIC_TABLES, scoreMetric } from '@/modules/rating'
import type { Metric, ModuleResult, Note } from '@/modules/types'
import { cn } from '@/lib/utils'
import { Formula } from './formula'
import { formatMetric, scoreTone } from './format'

export function RatioTable({ metrics }: { metrics: { moduleTitle: string; m: Metric }[] }) {
  const [open, setOpen] = useState<string | null>(null)
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-150 text-left">
        <thead>
          <tr className="border-b border-(--line) text-[11px] text-(--muted)">
            <th scope="col" className="px-3 py-1.5 font-medium">Module</th>
            <th className="px-3 py-1.5 font-medium">Metric</th>
            <th className="px-3 py-1.5 text-right font-medium">Value</th>
            <th className="px-3 py-1.5 text-right font-medium">Score</th>
            <th className="px-3 py-1.5 font-medium">Formula</th>
          </tr>
        </thead>
        <tbody>
          {metrics.map(({ moduleTitle, m }) => {
            const s = scoreMetric(m.id, m.value)
            return (
              <Fragment key={m.id}>
                <tr
                  onClick={() => setOpen(open === m.id ? null : m.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(open === m.id ? null : m.id) } }}
                  tabIndex={0}
                  aria-expanded={open === m.id}
                  className="cursor-pointer border-b border-(--line) hover:bg-(--panel-2)"
                >
                  <td className="px-3 py-1.5 text-(--muted)">{moduleTitle}</td>
                  <td className="px-3 py-1.5 font-medium">{m.label}</td>
                  <td className={cn('num px-3 py-1.5 text-right', m.value === null && 'text-(--muted)')}>{formatMetric(m)}{m.annualized ? <span className="ml-1 text-[10px] text-(--muted)" title="Scaled up from one quarter; seasonal businesses can swing">ann.</span> : null}</td>
                  <td className={cn('num px-3 py-1.5 text-right', scoreTone(s))}>{s === null ? '' : Math.round(s)}</td>
                  <td className="px-3 py-1.5 text-xs text-(--muted)"><Formula formula={m.formula} id={m.id} />{m.source === 'provider' ? <span className="ml-2 rounded bg-(--panel-2) px-1.5 py-px text-[10px] text-(--accent)">Finnhub, TTM</span> : null}</td>
                </tr>
                {open === m.id ? (
                  <tr className="border-b border-(--line) bg-(--panel-2)">
                    <td colSpan={5} className="px-3 py-2 text-xs">
                      <p className="mb-1.5 text-(--fg)"><Formula formula={m.formula} id={m.id} />{m.hint ? <span className="ml-3 text-(--muted)">{m.hint}</span> : null}</p>
                      {m.inputs.length ? (
                        <table className="w-full max-w-2xl">
                          <tbody>
                            {m.inputs.filter((i) => !Number.isNaN(i.value)).map((i) => (
                              <tr key={i.label}>
                                <td className="py-0.5 pr-3">{i.label}</td>
                                <td className="num py-0.5 pr-3 text-right">{Math.abs(i.value) >= 1e5 ? i.value.toLocaleString('en-US') : i.value}</td>
                                <td className="py-0.5 text-(--muted)">{i.tag}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : null}
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function RubricTable() {
  return (
    <div className="flex flex-col gap-3 p-3 text-xs">
      <p className="text-(--muted)">
        Metrics map to 0-100 through these tiers; categories average their metrics; the composite averages categories. 75+ Strong, 60+ Solid, 45+ Mixed, else Weak.
        Altman Z&apos;&apos;: 100 above 2.6, 55 to 1.1, else 10. Liabilities/assets: 100 up to 40%, 75 to 60%, 50 to 80%, else 25.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-120 text-left">
          <thead>
            <tr className="border-b border-(--line) text-[11px] text-(--muted)">
              <th className="py-1.5 font-medium">Metric</th>
              <th className="py-1.5 font-medium">Tiers (at least threshold gives score)</th>
              <th className="py-1.5 font-medium">Otherwise</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(RUBRIC_TABLES)
              .filter(([id]) => id !== 'liabilities-assets')
              .map(([id, t]) => (
                <tr key={id} className="border-b border-(--line)">
                  <td className="py-1.5 font-medium">{t.label}</td>
                  <td className="num py-1.5">{t.tiers.map(([min, s]) => `≥ ${t.pct ? `${(min * 100).toFixed(0)}%` : min} → ${s}`).join(' · ')}</td>
                  <td className="num py-1.5">{t.floor}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function NoteRow({ n }: { n: Note }) {
  const dot = n.tone === 'good' ? 'bg-(--up)' : n.tone === 'watch' ? 'bg-(--warn)' : 'bg-(--muted)'
  return (
    <li className="flex gap-2 border-b border-(--line) px-3 py-2 last:border-0">
      <span className={cn('mt-1.5 size-1.5 shrink-0 rounded-full', dot)} />
      <p className="text-xs leading-relaxed">{n.text}</p>
    </li>
  )
}

export const readTone: Record<string, string> = {
  Favorable: 'text-(--up)',
  Unfavorable: 'text-(--down)',
  'On par': 'text-(--accent)',
  'n/a': 'text-(--muted)',
}

function deltaText(c: { deltaPct: number | null; deltaPts: number | null }) {
  if (c.deltaPct !== null) return `${c.deltaPct >= 0 ? '+' : ''}${(c.deltaPct * 100).toFixed(0)}%`
  if (c.deltaPts !== null) return `${c.deltaPts >= 0 ? '+' : ''}${(c.deltaPts * 100).toFixed(1)} pts`
  return ''
}

/** Green = favorable side, red = unfavorable side, cyan = on par. Never the raw sign of the difference. */
export const deltaTone = (c: { read: string }) => readTone[c.read] ?? 'text-(--muted)'

/** A row shows only when the company value exists and at least one benchmark can be compared. */
export const industryRowVisible = (m: Metric) => m.value !== null && !!m.compare && (m.compare.flag !== 'n/a' || (!!m.compare.market && m.compare.market.flag !== 'n/a'))

export function IndustryTable({ result }: { result?: ModuleResult }) {
  const rows = result?.metrics.filter(industryRowVisible) ?? []
  if (!result || !rows.length) return null
  const fmt = (m: Metric, v: number) => formatMetric({ ...m, value: v })
  return (
    <div className="flex flex-col">
      <div className="overflow-x-auto">
        <table className="w-full min-w-190 text-left">
          <thead>
            <tr className="border-b border-(--line) text-[11px] text-(--muted)">
              <th className="px-3 py-1.5 font-medium">Metric</th>
              <th className="px-3 py-1.5 text-right font-medium">Company</th>
              <th className="px-3 py-1.5 text-right font-medium">Industry avg</th>
              <th className="px-3 py-1.5 text-right font-medium">vs. industry</th>
              <th className="px-3 py-1.5 font-medium">Flag</th>
              <th className="px-3 py-1.5 font-medium">Read</th>
              <th className="px-3 py-1.5 text-right font-medium">Market avg</th>
              <th className="px-3 py-1.5 text-right font-medium">vs. market</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => {
              const c = m.compare!
              const mk = c.market
              const own = c.flag !== 'n/a'
              const mkOk = !!mk && mk.flag !== 'n/a'
              return (
                <tr key={m.id} className="border-b border-(--line)">
                  <td className="px-3 py-1.5 font-medium">{m.label}</td>
                  <td className="num px-3 py-1.5 text-right">
                    {fmt(m, m.value!)}
                    {c.companySource ? <span className="ml-1 text-[10px] text-(--muted)">({c.companySource})</span> : null}
                  </td>
                  <td className="num px-3 py-1.5 text-right">{own ? fmt(m, c.benchmark) : ''}</td>
                  <td className={cn('num px-3 py-1.5 text-right', deltaTone(c))}>{own ? deltaText(c) : ''}</td>
                  <td className="px-3 py-1.5">
                    {own ? c.flag : ''}
                    {own && c.note ? <span className="ml-1 text-[10px] text-(--muted)" title={c.note}>*</span> : null}
                  </td>
                  <td className={cn('px-3 py-1.5', own ? readTone[c.read] : '')}>{own ? c.read : ''}</td>
                  <td className="num px-3 py-1.5 text-right text-(--muted)">{mkOk ? fmt(m, mk!.benchmark) : ''}</td>
                  <td className={cn('num px-3 py-1.5 text-right', mkOk ? deltaTone(mk!) : '')}>{mkOk ? deltaText(mk!) : ''}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <ul>{result.notes.map((n, i) => <NoteRow key={i} n={n} />)}</ul>
      <p className="px-3 py-2 text-[11px] text-(--muted)">
        Damodaran US aggregates (not medians), Jan 2026. Flag: Above/Below outside +/-5%; * = percentage points (negative average). Green = favorable, red = unfavorable: higher is better for margins, returns and coverage; lower is better for debt and multiples (below average = cheaper). Market avg: total US market.
      </p>
    </div>
  )
}

export function MarketTable({ result }: { result?: ModuleResult }) {
  if (!result || !result.metrics.length) return null
  return (
    <div className="flex flex-col">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-(--line) text-[11px] text-(--muted)">
            <th className="px-3 py-1.5 font-medium">Ratio</th>
            <th className="px-3 py-1.5 text-right font-medium">Provider</th>
            <th className="px-3 py-1.5 text-right font-medium">From filing</th>
          </tr>
        </thead>
        <tbody>
          {result.metrics.map((m) => {
            const ours = m.inputs.find((i) => i.label === 'Computed from filing')
            return (
              <tr key={m.id} className="border-b border-(--line)">
                <td className="px-3 py-1.5 font-medium">{m.label}</td>
                <td className="num px-3 py-1.5 text-right">{formatMetric(m)}</td>
                <td className="num px-3 py-1.5 text-right text-(--muted)">{ours ? formatMetric({ ...m, value: ours.value }) : ''}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <ul>{result.notes.map((n, i) => <NoteRow key={i} n={n} />)}</ul>
    </div>
  )
}
