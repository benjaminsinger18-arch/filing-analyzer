'use client'

import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Check, Moon, Search, SlidersHorizontal, Sun, Upload } from 'lucide-react'
import './terminal.css'
import { LINE_ITEM_LABELS, type Financials, type IndustryBenchmark, type Items, type LineItem, type MarketData } from '@/lib/financials'
import { normalize, NotIxbrlError } from '@/lib/ixbrl/normalize'
import { isIxbrl, parseIxbrl } from '@/lib/ixbrl/parse'
import { RATIO_MODULES, runModules } from '@/modules/registry'
import { RUBRIC_TABLES, scoreMetric } from '@/modules/rating'
import type { Metric, ModuleResult, Note, RatingResult } from '@/modules/types'
import type { Company } from '@/lib/search'
import { cn } from '@/lib/utils'
import { Formula } from './formula'

const MAX_BYTES = 40 * 1024 * 1024
const STORAGE_KEY = 'analyzer.disabledModules'
const THEME_KEY = 'analyzer.theme'

type FilingRef = { form: string; filingDate: string; reportDate: string; url: string }
type ChartTab = 'income' | 'balance' | 'cash'
type BottomTab = 'ratios' | 'industry' | 'market' | 'rubric' | 'filing'

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

const compactUsd = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 2 }).format(v)

// Middle scores (45-59) are plain: neutral text and a gray bar, so only green and red carry meaning.
const scoreTone = (s: number | null) => (s === null ? 'text-(--muted)' : s >= 60 ? 'text-(--up)' : s >= 45 ? 'text-(--fg)' : 'text-(--down)')
const scoreDepth = (s: number) => (s >= 60 ? 'var(--depth-up)' : s >= 45 ? 'color-mix(in srgb, var(--muted) 25%, transparent)' : 'var(--depth-down)')
const tierTone: Record<RatingResult['tier'], string> = {
  Strong: 'bg-(--up-bg) text-(--up)',
  Solid: 'bg-(--up-bg) text-(--up)',
  Mixed: 'bg-(--warn-bg) text-(--warn)',
  Weak: 'bg-(--down-bg) text-(--down)',
  'Insufficient data': 'bg-(--panel-2) text-(--muted)',
}

function Panel({ title, right, children, className }: { title: string; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('flex min-h-0 flex-col rounded-md border border-(--line) bg-(--panel)', className)}>
      <header className="flex items-center justify-between gap-2 border-b border-(--line) px-3 py-2">
        <h3 className="text-xs font-semibold tracking-wide text-(--accent) uppercase">{title}</h3>
        {right}
      </header>
      {children}
    </section>
  )
}

function Chip({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('inline-flex w-fit rounded px-2 py-0.5 text-[11px] font-medium', className)}>{children}</span>
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('rounded px-2.5 py-1 text-xs', active ? 'bg-(--panel-2) font-semibold text-(--accent)' : 'text-(--muted) hover:text-(--fg)')}
    >
      {children}
    </button>
  )
}

/** Which direction of change is good for each chart item; 'none' items are not judged. */
const GOOD_WHEN: Partial<Record<LineItem, 'down' | 'none'>> = { liabilities: 'down', debt: 'down', capex: 'none', da: 'none' }

function changeColor(item: LineItem, cur: number, prior: number): string {
  const good = GOOD_WHEN[item]
  if (good === 'none' || cur === prior) return 'var(--accent)'
  return (cur > prior) === (good !== 'down') ? 'var(--up)' : 'var(--down)'
}

const CHART_ITEMS: Record<ChartTab, { label: string; items: LineItem[] }> = {
  income: { label: 'Income', items: ['revenue', 'grossProfit', 'operatingIncome', 'netIncome'] },
  balance: { label: 'Balance sheet', items: ['assets', 'liabilities', 'equity', 'cash', 'debt'] },
  cash: { label: 'Cash flow', items: ['ocf', 'capex', 'da'] },
}

function chartSources(fin: Financials, tab: ChartTab): { cur: Items; prior: Items; curLabel: string; priorLabel: string } {
  if (tab === 'balance') return { cur: fin.bsCur, prior: fin.bsPrior, curLabel: fin.meta.periodEnd, priorLabel: 'prior year-end' }
  if (tab === 'cash') return { cur: fin.ytd, prior: fin.ytdPrior, curLabel: fin.basis === 'quarter' ? 'YTD' : 'FY', priorLabel: 'prior YTD' }
  return { cur: fin.cur, prior: fin.prior, curLabel: fin.basis === 'quarter' ? 'quarter' : 'FY', priorLabel: fin.basis === 'quarter' ? 'prior-yr quarter' : 'prior FY' }
}

function FundamentalsChart({ fin, tab }: { fin: Financials; tab: ChartTab }) {
  const src = chartSources(fin, tab)
  const rows = CHART_ITEMS[tab].items
    .filter((i) => src.cur[i] || src.prior[i])
    .map((i) => ({
      item: i,
      name: LINE_ITEM_LABELS[i],
      cur: src.cur[i]?.value ?? 0,
      prior: src.prior[i]?.value ?? 0,
      has: !!src.cur[i],
      hasPrior: !!src.prior[i],
    }))
  if (!rows.length) return null
  return (
    <div className="min-h-72 flex-1 px-2 pb-2">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 12, right: 12, bottom: 0, left: 4 }} barGap={3}>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted)' }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} tickLine={false} axisLine={false} tickFormatter={(v) => compactUsd(v).replace('.00', '')} width={64} />
          <Tooltip
            cursor={{ fill: 'var(--panel-2)' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const p = payload[0].payload as (typeof rows)[number]
              const chg = p.hasPrior && p.prior !== 0 ? (p.cur - p.prior) / Math.abs(p.prior) : null
              return (
                <div className="rounded border border-(--line) bg-(--panel) px-3 py-2 text-xs text-(--fg) shadow-lg">
                  <p className="font-semibold">{p.name}</p>
                  {p.has ? <p className="num">{src.curLabel}: {compactUsd(p.cur)}</p> : null}
                  {p.hasPrior ? <p className="num text-(--muted)">{src.priorLabel}: {compactUsd(p.prior)}</p> : null}
                  {chg !== null ? <p className="num" style={{ color: changeColor(p.item, p.cur, p.prior) }}>{chg >= 0 ? '+' : ''}{(chg * 100).toFixed(1)}%</p> : null}
                </div>
              )
            }}
          />
          <Bar dataKey="prior" fill="var(--line)" radius={[3, 3, 0, 0]} maxBarSize={36} />
          <Bar dataKey="cur" radius={[3, 3, 0, 0]} maxBarSize={36}>
            {rows.map((r) => (
              <Cell key={r.name} fill={changeColor(r.item, r.cur, r.prior)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function StatStrip({ fin }: { fin: Financials }) {
  const src = chartSources(fin, 'income')
  const items = (['revenue', 'operatingIncome', 'netIncome', 'epsDiluted'] as LineItem[]).filter((i) => src.cur[i])
  if (!items.length) return null
  return (
    <div className="flex flex-wrap gap-px bg-(--line)">
      {items.map((i) => {
        const cur = src.cur[i]!.value
        const prior = src.prior[i]?.value
        const chg = prior !== undefined && prior > 0 ? (cur - prior) / prior : null
        return (
          <div key={i} className="min-w-40 flex-1 bg-(--panel) px-3 py-2">
            <p className="text-[11px] text-(--muted)">{LINE_ITEM_LABELS[i]}</p>
            <p className="num text-base font-semibold">{i === 'epsDiluted' ? `$${cur.toFixed(2)}` : compactUsd(cur)}</p>
            {chg !== null ? <p className={cn('num text-xs', chg >= 0 ? 'text-(--up)' : 'text-(--down)')}>{chg >= 0 ? '+' : ''}{(chg * 100).toFixed(1)}%</p> : null}
          </div>
        )
      })}
    </div>
  )
}

function RatioTable({ metrics }: { metrics: { moduleTitle: string; m: Metric }[] }) {
  const [open, setOpen] = useState<string | null>(null)
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-150 text-left">
        <thead>
          <tr className="border-b border-(--line) text-[11px] text-(--muted)">
            <th className="px-3 py-1.5 font-medium">Module</th>
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
                <tr onClick={() => setOpen(open === m.id ? null : m.id)} className="cursor-pointer border-b border-(--line) hover:bg-(--panel-2)">
                  <td className="px-3 py-1.5 text-(--muted)">{moduleTitle}</td>
                  <td className="px-3 py-1.5 font-medium">{m.label}</td>
                  <td className={cn('num px-3 py-1.5 text-right', m.value === null && 'text-(--muted)')}>{formatMetric(m)}</td>
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

function RubricTable() {
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

function NoteRow({ n }: { n: Note }) {
  const dot = n.tone === 'good' ? 'bg-(--up)' : n.tone === 'watch' ? 'bg-(--warn)' : 'bg-(--muted)'
  return (
    <li className="flex gap-2 border-b border-(--line) px-3 py-2 last:border-0">
      <span className={cn('mt-1.5 size-1.5 shrink-0 rounded-full', dot)} />
      <p className="text-xs leading-relaxed">{n.text}</p>
    </li>
  )
}

const readTone: Record<string, string> = {
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
const deltaTone = (c: { read: string }) => readTone[c.read] ?? 'text-(--muted)'

/** A row shows only when the company value exists and at least one benchmark can be compared. */
const industryRowVisible = (m: Metric) => m.value !== null && !!m.compare && (m.compare.flag !== 'n/a' || (!!m.compare.market && m.compare.market.flag !== 'n/a'))

function IndustryTable({ result }: { result?: ModuleResult }) {
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

function MarketTable({ result }: { result?: ModuleResult }) {
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

export function Analyzer() {
  const [fin, setFin] = useState<Financials | null>(null)
  const [history, setHistory] = useState<Financials[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [price, setPrice] = useState('')
  const [market, setMarket] = useState<MarketData | null>(null)
  const [industry, setIndustry] = useState<IndustryBenchmark | null>(null)
  const [industryOptions, setIndustryOptions] = useState<string[]>([])
  const [priceNote, setPriceNote] = useState<string | null>(null)
  const [ticker, setTicker] = useState('')
  const [symbol, setSymbol] = useState<string | null>(null)
  const [suggest, setSuggest] = useState<Company[]>([])
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [formType, setFormType] = useState<'10-K' | '10-Q'>('10-K')
  const [filings, setFilings] = useState<FilingRef[] | null>(null)
  const [enabled, setEnabled] = useState<Set<string>>(new Set(RATIO_MODULES.map((m) => m.id)))
  const [dark, setDark] = useState(true)
  const [drag, setDrag] = useState(false)
  const [chartTab, setChartTab] = useState<ChartTab>('income')
  const [bottomTab, setBottomTab] = useState<BottomTab>('ratios')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const disabled = new Set(JSON.parse(raw) as string[])
        // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring persisted preferences after hydration
        setEnabled(new Set(RATIO_MODULES.map((m) => m.id).filter((id) => !disabled.has(id))))
      }
      const t = localStorage.getItem(THEME_KEY)
      if (t) setDark(t === 'dark')
    } catch {}
  }, [])

  const toggleModule = (id: string) => {
    setEnabled((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(RATIO_MODULES.map((m) => m.id).filter((id) => !next.has(id))))
      } catch {}
      return next
    })
  }

  const enableAllModules = () => {
    setEnabled(new Set(RATIO_MODULES.map((m) => m.id)))
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {}
  }

  const disableAllModules = () => {
    setEnabled(new Set())
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(RATIO_MODULES.map((m) => m.id)))
    } catch {}
  }

  const toggleTheme = () => {
    setDark((d) => {
      try {
        localStorage.setItem(THEME_KEY, d ? 'light' : 'dark')
      } catch {}
      return !d
    })
  }

  const results = useMemo(() => {
    if (!fin) return null
    const p = Number(price)
    return runModules({ ...fin, price: p > 0 ? p : undefined, priceAsOf: market?.priceAsOf ?? undefined, market: market ?? undefined, industry: industry ?? undefined })
  }, [fin, price, market, industry])

  async function loadIndustry(params: string) {
    try {
      const res = await fetch(`/api/industry?${params}`)
      const body = await res.json()
      setIndustryOptions(body.options ?? [])
      setIndustry(body.industry ?? null)
    } catch {
      setIndustry(null)
    }
  }

  const present = (f: Financials) => {
    setFin(f)
    // Keep a price already fetched for this ticker; otherwise fetch one so valuation works right away.
    if (!f.meta.ticker || market?.ticker !== f.meta.ticker.toUpperCase()) {
      setMarket(null)
      setPrice('')
      setPriceNote(null)
      if (f.meta.ticker) void fetchMarket(f.meta.ticker)
    }
    void loadIndustry(f.meta.ticker ? `ticker=${encodeURIComponent(f.meta.ticker)}` : '')
    setHistory((h) =>
      [f, ...h.filter((x) => !(x.meta.name === f.meta.name && x.meta.form === f.meta.form && x.meta.periodEnd === f.meta.periodEnd))]
        .sort((a, b) => b.meta.periodEnd.localeCompare(a.meta.periodEnd) || a.meta.name.localeCompare(b.meta.name))
        .slice(0, 12),
    )
  }

  async function handleFile(file: File) {
    setError(null)
    setFilings(null)
    if (file.size > MAX_BYTES) return setError('That file is larger than 40 MB.')
    if (!/\.(htm|html|xhtml)$/i.test(file.name)) {
      return setError('Upload an EDGAR .htm filing (inline XBRL).')
    }
    setLoading(true)
    try {
      const parsed = parseIxbrl(await file.text())
      if (!isIxbrl(parsed)) throw new NotIxbrlError('No inline-XBRL data found. Use the main .htm of a 2019+ filing.')
      present(normalize(parsed))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that filing.')
    } finally {
      setLoading(false)
    }
  }

  // Debounced company search as the user types (partial names and tickers).
  useEffect(() => {
    const q = ticker.trim()
    if (!q || symbol) return
    let stale = false
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
        const body = await res.json()
        if (!stale) {
          setSuggest(body.results ?? [])
          setActive(-1)
        }
      } catch {
        if (!stale) setSuggest([])
      }
    }, 180)
    return () => {
      stale = true
      clearTimeout(t)
    }
  }, [ticker, symbol])

  function pick(c: Company) {
    setTicker(c.ticker)
    setSymbol(c.ticker)
    setSuggestOpen(false)
    void searchTicker(c.ticker)
  }

  /** Enter / FIND: take the highlighted or top suggestion unless the text is already an exact ticker. */
  function submit() {
    const s = suggest[active] ?? suggest[0]
    if (s && suggestOpen && (active >= 0 || ticker.trim().toUpperCase() !== s.ticker)) return pick(s)
    void searchTicker()
  }

  async function searchTicker(sym?: string) {
    const t = (sym ?? ticker).trim()
    if (!t) return
    setError(null)
    setLoading(true)
    setFilings(null)
    try {
      const res = await fetch(`/api/edgar?ticker=${encodeURIComponent(t)}&form=${formType}`)
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Lookup failed.')
      setFilings([...(body.filings as FilingRef[])].sort((a, b) => b.reportDate.localeCompare(a.reportDate)))
      if (!body.filings.length) setError(body.note ?? `No ${formType} filings found for ${t.toUpperCase()}.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lookup failed.')
    } finally {
      setLoading(false)
    }
  }

  async function fetchMarket(symbolArg?: string) {
    const sym = (symbolArg ?? fin?.meta.ticker ?? symbol ?? ticker).trim()
    if (!sym) return setPriceNote('Enter a ticker or load a filing first.')
    setPriceNote('Fetching...')
    try {
      const res = await fetch(`/api/market?ticker=${encodeURIComponent(sym)}`)
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Price lookup failed.')
      const m = body as MarketData
      setMarket(m)
      setPrice(String(m.price))
      setPriceNote(`USD ${m.price} as of ${m.priceAsOf ?? 'latest'} · ${m.source}`)
    } catch (e) {
      setPriceNote(e instanceof Error ? e.message : 'Price lookup failed.')
    }
  }

  async function loadFiling(url: string) {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/edgar?url=${encodeURIComponent(url)}`)
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Could not load that filing.')
      present(body.financials)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load that filing.')
    } finally {
      setLoading(false)
    }
  }

  const rating = results?.rating?.rating
  const industryRows = results?.industry?.metrics.filter(industryRowVisible).length ?? 0
  const marketRows = results?.market?.metrics.length ?? 0
  const tab: BottomTab = (bottomTab === 'industry' && !industryRows) || (bottomTab === 'market' && !marketRows) ? 'ratios' : bottomTab
  const allMetrics = results
    ? RATIO_MODULES.filter((m) => results[m.id] && enabled.has(m.id) && m.id !== 'industry' && m.id !== 'market').flatMap((m) => results[m.id].metrics.map((metric) => ({ moduleTitle: m.title, m: metric })))
    : []
  const book = allMetrics.filter(({ m }) => m.value !== null)
  const ratioRows = allMetrics.filter(({ m }) => m.value !== null)
  const ratingOf = (f: Financials) => {
    const r = runModules(f).rating?.rating
    return r?.composite == null ? null : Math.round(r.composite)
  }

  return (
    <div className={cn('terminal flex h-svh flex-col overflow-hidden', dark && 'dark')}>
      <nav className="flex h-11 shrink-0 items-center justify-between gap-4 border-b border-(--line) bg-(--panel) px-3">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2">
            <span className="flex h-5 items-end gap-0.5" aria-hidden>
              <i className="block h-3 w-1 bg-(--down)" />
              <i className="block h-5 w-1 bg-(--up)" />
              <i className="block h-4 w-1 bg-(--down)" />
            </span>
            <span className="text-base font-bold tracking-wide">FILINGS</span>
          </div>
          <span className="hidden text-xs text-(--muted) sm:inline">10-K / 10-Q analyzer</span>
        </div>
        <div className="flex items-center gap-2">
          <a href="#appendix" className="rounded px-2 py-1 text-xs text-(--muted) hover:text-(--fg)">Appendix</a>
          <details className="relative">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded px-2 py-1 text-xs text-(--muted) hover:text-(--fg)">
              <SlidersHorizontal className="size-3.5" /> Show / hide
            </summary>
            <div className="absolute right-0 z-20 mt-1 flex w-72 flex-col gap-0.5 rounded-md border border-(--line) bg-(--panel) p-2 shadow-xl">
              <div className="mb-1 flex justify-end gap-1">
                <button type="button" onClick={enableAllModules} className="rounded px-2 py-0.5 text-[11px] text-(--accent) hover:bg-(--panel-2)">Select all</button>
                <button type="button" onClick={disableAllModules} className="rounded px-2 py-0.5 text-[11px] text-(--accent) hover:bg-(--panel-2)">Deselect all</button>
              </div>
              {RATIO_MODULES.map((m) => (
                <label key={m.id} className="flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 hover:bg-(--panel-2)">
                  <input type="checkbox" className="mt-0.5" checked={enabled.has(m.id)} onChange={() => toggleModule(m.id)} />
                  <span>
                    <span className="block text-xs font-semibold">{m.title}</span>
                    <span className="block text-[11px] text-(--muted)">{m.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </details>
          <button type="button" onClick={toggleTheme} aria-label="Toggle theme" className="rounded p-1.5 text-(--muted) hover:text-(--fg)">
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
        </div>
      </nav>

      <div className="shrink-0 border-b border-(--line) bg-(--panel-2) px-3 py-1 text-[11px] text-(--muted)">
        Rules-based screen of one filing. Not investment advice.
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto scroll-smooth">
      <main className="grid grid-cols-1 gap-2 p-2 lg:h-[calc(100svh-4.5rem)] lg:grid-cols-[280px_minmax(0,1fr)_340px] lg:overflow-hidden">
        {/* Left: watchlist + observations */}
        <div className="flex min-h-0 flex-col gap-2 lg:overflow-y-auto">
          {history.length ? (
          <Panel title="Analyzed" className="shrink-0">
            <div className="max-h-72 overflow-y-auto">
              {history.length > 0 ? (
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[11px] text-(--muted)">
                      <th className="px-3 py-1.5 font-medium">Company</th>
                      <th className="px-3 py-1.5 text-right font-medium">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => {
                      const s = ratingOf(h)
                      const active = fin === h
                      return (
                        <tr key={`${h.meta.name}${h.meta.form}${h.meta.periodEnd}`} onClick={() => setFin(h)} className={cn('cursor-pointer border-t border-(--line) hover:bg-(--panel-2)', active && 'bg-(--accent)/15 shadow-[inset_4px_0_0_var(--accent)]')}>
                          <td className="px-3 py-1.5">
                            <span className="block font-semibold">{h.meta.ticker ?? h.meta.name}</span>
                            <span className="block text-[11px] text-(--muted)">{h.meta.form} · {h.meta.periodEnd}</span>
                          </td>
                          <td className={cn('num px-3 py-1.5 text-right text-sm font-semibold', scoreTone(s))}>{s ?? ''}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              ) : null}
            </div>
          </Panel>
          ) : null}
          {results && results.notes.notes.length ? (
          <Panel title="Observations" className="min-h-40 flex-1">
            <ul className="min-h-0 overflow-y-auto">
              {results.notes.notes.map((n, i) => <NoteRow key={i} n={n} />)}
            </ul>
          </Panel>
          ) : null}
        </div>

        {/* Center: header, chart, loader, tables */}
        <div className="flex min-h-0 flex-col gap-2 lg:overflow-y-auto">
          <Panel title="Load filing" className="shrink-0">
            <div className="grid grid-cols-1 gap-3 p-3 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold">Search company or ticker</p>
                <div className="flex gap-2">
                  <div className="relative">
                    <input
                      value={ticker}
                      onChange={(e) => {
                        setTicker(e.target.value)
                        setSymbol(null)
                        setSuggestOpen(true)
                        if (!e.target.value.trim()) setSuggest([])
                      }}
                      onFocus={() => setSuggestOpen(true)}
                      onBlur={() => setTimeout(() => setSuggestOpen(false), 150)}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowDown') {
                          e.preventDefault()
                          setSuggestOpen(true)
                          setActive((i) => Math.min(i + 1, suggest.length - 1))
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault()
                          setActive((i) => Math.max(i - 1, -1))
                        } else if (e.key === 'Escape') setSuggestOpen(false)
                        else if (e.key === 'Enter') submit()
                      }}
                      placeholder="Apple or AAPL"
                      aria-label="Ticker"
                      autoComplete="off"
                      className="h-8 w-56 px-2"
                    />
                    {suggestOpen && suggest.length > 0 && !symbol ? (
                      <ul className="absolute z-30 mt-1 max-h-72 w-80 overflow-y-auto rounded-md border border-(--line) bg-(--panel) py-1 shadow-xl" role="listbox">
                        {suggest.map((c, i) => (
                          <li key={c.ticker}>
                            <button
                              type="button"
                              role="option"
                              aria-selected={i === active}
                              onMouseDown={(e) => {
                                e.preventDefault()
                                pick(c)
                              }}
                              onMouseEnter={() => setActive(i)}
                              className={cn('flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs', i === active && 'bg-(--panel-2)')}
                            >
                              <span className="num w-14 shrink-0 font-semibold">{c.ticker}</span>
                              <span className="truncate text-(--muted)">{c.name}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                  <select value={formType} onChange={(e) => setFormType(e.target.value as '10-K' | '10-Q')} aria-label="Form type" className="h-8 px-2">
                    <option>10-K</option>
                    <option>10-Q</option>
                  </select>
                  <button type="button" onClick={submit} className="flex h-8 items-center gap-1.5 rounded bg-(--up) px-3 text-xs font-bold text-black">
                    <Search className="size-3.5" /> FIND
                  </button>
                </div>
                {filings?.length ? (
                  <ul className="flex flex-col">
                    {filings.map((f) => {
                      const selected = fin?.meta.sourceUrl === f.url
                      return (
                        <li key={f.url}>
                          <button
                            type="button"
                            onClick={() => void loadFiling(f.url)}
                            aria-current={selected ? 'true' : undefined}
                            className={cn(
                              'flex w-full items-center justify-between gap-2 border-b border-l-4 border-(--line) px-2 py-1.5 text-left text-xs hover:bg-(--panel-2)',
                              selected ? 'border-l-(--accent) bg-(--accent)/15 font-semibold' : 'border-l-transparent',
                            )}
                          >
                            <span className="num flex items-center gap-1.5">
                              {selected ? <Check className="size-3.5 text-(--accent)" /> : null}
                              {f.form} · {f.reportDate}
                              {selected ? <span className="rounded bg-(--accent) px-1.5 py-px text-[10px] font-bold text-black">LOADED</span> : null}
                            </span>
                            <span className="num font-normal text-(--muted)">filed {f.filingDate}</span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                ) : null}
                <div className="flex flex-col gap-1">
                  <label className="flex items-center gap-2 text-[11px] text-(--muted)">
                    Share price (optional)
                    <input value={price} onChange={(e) => { setPrice(e.target.value); setPriceNote(null) }} inputMode="decimal" placeholder="185.50" className="num h-7 w-24 px-2 text-xs" />
                    <button type="button" onClick={() => void fetchMarket()} className="h-7 rounded border border-(--line) px-2 text-[11px] text-(--accent) hover:bg-(--panel-2)">Fetch latest</button>
                  </label>
                  {priceNote ? <p className="text-[11px] text-(--muted)">{priceNote}</p> : null}
                </div>
              </div>
              <div
                onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) void handleFile(f) }}
                className={cn('flex flex-col items-center justify-center gap-1.5 rounded border border-dashed border-(--line) p-4 text-center', drag && 'bg-(--panel-2)')}
              >
                <Upload className="size-4 text-(--muted)" />
                <p className="text-xs font-semibold">Drop a 10-K / 10-Q .htm file</p>
                <p className="text-[11px] text-(--muted)">EDGAR .htm, 2019+</p>
                <input ref={fileRef} type="file" accept=".htm,.html,.xhtml" className="hidden" onChange={(e) => e.target.files?.[0] && void handleFile(e.target.files[0])} />
                <button type="button" onClick={() => fileRef.current?.click()} className="rounded border border-(--line) px-3 py-1 text-xs hover:bg-(--panel-2)">Choose file</button>
              </div>
            </div>
            {loading ? <p className="px-3 pb-3 text-xs text-(--muted)">Working...</p> : null}
            {error ? <p className="mx-3 mb-3 rounded bg-(--down-bg) px-3 py-2 text-xs text-(--down)">{error}</p> : null}
          </Panel>

          {fin ? (
          <Panel
            title={`${fin.meta.ticker ?? ''} ${fin.meta.name}`.trim()}
            right={
              fin ? (
                <div className="flex items-center gap-2 text-[11px] text-(--muted)">
                  <Chip className="bg-(--panel-2) text-(--fg)">{fin.meta.form}{fin.meta.fiscalPeriod ? ` ${fin.meta.fiscalPeriod}` : ''}</Chip>
                  <span className="num">period end {fin.meta.periodEnd}</span>
                  <select
                    value=""
                    onChange={(e) => e.target.value && void loadIndustry(`name=${encodeURIComponent(e.target.value)}`)}
                    aria-label="Industry"
                    className="h-6 max-w-44 px-1 text-[11px]"
                  >
                    <option value="">{industry ? industry.name : 'Pick industry'}</option>
                    {industryOptions.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                  {fin.meta.sourceUrl ? <a className="text-(--accent) underline" href={fin.meta.sourceUrl} target="_blank" rel="noreferrer">filing</a> : null}
                </div>
              ) : null
            }
            className="min-h-96 flex-1"
          >
            {fin ? (
              <>
                <StatStrip fin={fin} />
                <div className="flex items-center gap-1 border-b border-(--line) px-2 py-1.5">
                  {(Object.keys(CHART_ITEMS) as ChartTab[]).map((t) => (
                    <Tab key={t} active={chartTab === t} onClick={() => setChartTab(t)}>{CHART_ITEMS[t].label}</Tab>
                  ))}
                  <span className="ml-auto text-[11px] text-(--muted)">
                    {fin.basis === 'quarter' ? 'Quarter vs. prior-year quarter · cash flow YTD' : 'FY vs. prior FY'}
                  </span>
                </div>
                <FundamentalsChart fin={fin} tab={chartTab} />
              </>
            ) : null}
          </Panel>
          ) : null}

        </div>

        {/* Right: rating + ratio book */}
        <div className="flex min-h-0 flex-col gap-2 lg:overflow-y-auto">
          {rating && rating.composite !== null ? (
          <Panel title="Screening rating" className="shrink-0">
            {rating ? (
              <div className="flex flex-col gap-3 p-3">
                <div className="flex items-end justify-between">
                  <div>
                    <p className={cn('num text-4xl leading-none font-bold', scoreTone(rating.composite))}>{Math.round(rating.composite)}</p>
                    <p className="mt-1 text-[11px] text-(--muted)">{rating.used}/{rating.total} categories</p>
                  </div>
                  <Chip className={cn('text-sm', tierTone[rating.tier])}>{rating.tier}</Chip>
                </div>
                <div className="flex flex-col gap-1.5">
                  {rating.categories.filter((c) => c.score !== null).map((c) => (
                    <div key={c.id} title={c.basis.join('\n')} className="relative flex items-center justify-between overflow-hidden rounded px-2 py-1">
                      <span className="absolute inset-y-0 left-0" style={{ width: `${c.score ?? 0}%`, background: c.score === null ? 'transparent' : scoreDepth(c.score) }} />
                      <span className="relative text-xs">{c.label}</span>
                      <span className={cn('num relative text-xs font-semibold', scoreTone(c.score))}>{Math.round(c.score as number)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </Panel>
          ) : null}

          {book.length ? (
          <Panel title="Ratio book" className="min-h-60 flex-1">
            <div className="min-h-0 overflow-y-auto">
              {book.length ? (
                <table className="w-full text-left">
                  <tbody>
                    {book.map(({ m }) => {
                      const s = scoreMetric(m.id, m.value)
                      return (
                        <tr key={m.id} className="border-b border-(--line)">
                          <td className="px-3 py-1.5">
                            <span className="text-xs">{m.label}</span>
                          </td>
                          <td className={cn('num px-3 py-1.5 text-right text-xs', scoreTone(s))}>{formatMetric(m)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              ) : null}
            </div>
          </Panel>
          ) : null}
        </div>
      </main>
      {fin ? (
      <section id="appendix" className="p-2 pt-0">
    <Panel
      title="Appendix"
      className="min-h-60"
      right={
        <div className="flex gap-1">
          <Tab active={tab === 'ratios'} onClick={() => setBottomTab('ratios')}>A. Ratios</Tab>
          {industryRows ? <Tab active={tab === 'industry'} onClick={() => setBottomTab('industry')}>B. Industry</Tab> : null}
          {marketRows ? <Tab active={tab === 'market'} onClick={() => setBottomTab('market')}>C. Market</Tab> : null}
          <Tab active={tab === 'rubric'} onClick={() => setBottomTab('rubric')}>D. Rubric</Tab>
          <Tab active={tab === 'filing'} onClick={() => setBottomTab('filing')}>E. Filing</Tab>
        </div>
      }
    >
      {tab === 'industry' ? (
        results ? <IndustryTable result={results.industry} /> : null
      ) : tab === 'market' ? (
        results ? <MarketTable result={results.market} /> : null
      ) : tab === 'rubric' ? (
        <RubricTable />
      ) : tab === 'filing' ? (
        fin ? (
          <dl className="grid grid-cols-[140px_1fr] gap-x-3 gap-y-1.5 p-3 text-xs">
            {([
              ['Company', fin.meta.name], ['Ticker', fin.meta.ticker], ['CIK', fin.meta.cik], ['Form', `${fin.meta.form} ${fin.meta.fiscalPeriod}`.trim()],
              ['Period end', fin.meta.periodEnd], ['Basis', fin.basis === 'annual' ? 'Annual' : 'Quarter (ratios annualized x4; cash flow YTD)'],
              ['Balance-sheet comparison', fin.bsPrior.assets ? 'prior fiscal year-end' : undefined],
            ] as [string, string | undefined][]).filter((row): row is [string, string] => !!row[1]).map(([k, v]) => (
              <Fragment key={k}>
                <dt className="text-(--muted)">{k}</dt>
                <dd className="num">{v}</dd>
              </Fragment>
            ))}
          </dl>
        ) : null
      ) : results ? (
        <RatioTable metrics={ratioRows} />
      ) : null}
    </Panel>
      </section>
      ) : null}
      </div>
    </div>
  )
}
