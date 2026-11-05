'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, FileText, Info, Search, Upload } from 'lucide-react'
import './theme.css'
import type { Financials } from '@/lib/financials'
import { normalize, NotIxbrlError } from '@/lib/ixbrl/normalize'
import { isIxbrl, parseIxbrl } from '@/lib/ixbrl/parse'
import { ALL_MODULES, RATIO_MODULES, runModules } from '@/modules/registry'
import type { Metric, ModuleResult, Note, RatingResult } from '@/modules/types'
import { cn } from '@/lib/utils'

const MAX_BYTES = 40 * 1024 * 1024
const STORAGE_KEY = 'analyzer.enabledModules'

type FilingRef = { form: string; filingDate: string; reportDate: string; url: string }

export function formatMetric(m: Metric): string {
  if (m.value === null) return 'n/a'
  const v = m.value
  switch (m.unit) {
    case '%': return `${(v * 100).toFixed(1)}%`
    case 'x': return `${v.toFixed(2)}x`
    case 'days': return `${Math.round(v)} days`
    case 'usd': return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 2 }).format(v)
    case 'score': return m.id === 'piotroski' ? `${v} / 9` : v.toFixed(2)
    default: return String(v)
  }
}

const toneStyle: Record<Note['tone'], string> = {
  good: 'text-(--vital-good)',
  watch: 'text-(--prediction-warn)',
  info: 'text-muted-foreground',
}

function Chip({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('inline-flex w-fit rounded-xl px-2.5 py-1 text-xs font-medium', className)}>{children}</span>
}

function NoteList({ notes }: { notes: Note[] }) {
  if (!notes.length) return null
  return (
    <ul className="flex flex-col gap-2">
      {notes.map((n, i) => {
        const Icon = n.tone === 'good' ? CheckCircle2 : n.tone === 'watch' ? AlertTriangle : Info
        return (
          <li key={i} className="flex items-start gap-3 rounded-xl bg-muted px-3 py-2.5">
            <Icon className={cn('mt-0.5 size-4 shrink-0', toneStyle[n.tone])} />
            <p className="text-sm">{n.text}</p>
          </li>
        )
      })}
    </ul>
  )
}

function MetricCard({ m }: { m: Metric }) {
  return (
    <article className="flex min-w-0 flex-col gap-2 rounded-2xl border p-4">
      <p className="text-sm font-medium tracking-tight">{m.label}</p>
      <p className={cn('text-2xl leading-none font-semibold tracking-tight', m.value === null && 'text-muted-foreground')}>
        {formatMetric(m)}
      </p>
      <p className="text-xs text-muted-foreground">{m.formula}</p>
      {m.reason ? <p className="text-xs text-(--prediction-warn)">{m.reason}</p> : null}
      {m.hint ? <p className="text-xs text-muted-foreground">{m.hint}</p> : null}
      {m.inputs.length ? (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground">Show inputs and XBRL tags</summary>
          <table className="mt-2 w-full">
            <tbody>
              {m.inputs.map((i) => (
                <tr key={i.label} className="border-t">
                  <td className="py-1 pr-2">{i.label}</td>
                  <td className="py-1 pr-2 text-right">
                    {Number.isNaN(i.value) ? 'n/a' : Math.abs(i.value) >= 1e5 ? i.value.toLocaleString('en-US') : i.value}
                  </td>
                  <td className="py-1 text-muted-foreground">{i.tag}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      ) : null}
    </article>
  )
}

function ModuleSection({ result, description }: { result: ModuleResult; description: string }) {
  return (
    <section className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-medium">{result.title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {result.metrics.length ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {result.metrics.map((m) => (
            <MetricCard key={m.id} m={m} />
          ))}
        </div>
      ) : null}
      <NoteList notes={result.notes} />
    </section>
  )
}

const tierTone: Record<RatingResult['tier'], string> = {
  Strong: 'bg-(--live)/10 text-(--live)',
  Solid: 'bg-(--live)/10 text-(--live)',
  Mixed: 'bg-(--chart-warn-bg) text-(--chart-warn)',
  Weak: 'bg-(--insight-vitals)/10 text-(--insight-vitals)',
  'Insufficient data': 'bg-muted text-muted-foreground',
}

function RatingCard({ r }: { r: RatingResult }) {
  return (
    <article className="flex flex-col gap-4 rounded-2xl border bg-[linear-gradient(180deg,rgb(99_102_241/0.08)_0%,transparent_42%)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-medium">Screening rating</h2>
          <p className="text-xs text-muted-foreground">
            Based on {r.used} of {r.total} categories with enough data. Rubric tables are in <code>src/modules/rating.ts</code>.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Chip className={cn('text-base', tierTone[r.tier])}>{r.tier}</Chip>
          <p className="text-3xl font-semibold tracking-tight">{r.composite === null ? '-' : Math.round(r.composite)}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-5">
        {r.categories.map((c) => (
          <div key={c.id} className="flex flex-col gap-2 rounded-xl bg-background p-3">
            <p className="text-sm font-medium">{c.label}</p>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-(--bionis-blue)" style={{ width: `${c.score ?? 0}%` }} />
            </div>
            <p className="text-xs text-muted-foreground">{c.score === null ? 'Not enough data' : `${Math.round(c.score)} / 100`}</p>
            <ul className="text-xs text-muted-foreground">
              {c.basis.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
        This is a rules-based screen of one filing, not personalized investment advice and not a recommendation to buy, sell
        or hold any security. It ignores price, industry context, management and everything outside the financial statements.
      </p>
    </article>
  )
}

export function Analyzer() {
  const [fin, setFin] = useState<Financials | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [price, setPrice] = useState('')
  const [ticker, setTicker] = useState('')
  const [formType, setFormType] = useState<'10-K' | '10-Q'>('10-K')
  const [filings, setFilings] = useState<FilingRef[] | null>(null)
  const [enabled, setEnabled] = useState<Set<string>>(new Set(RATIO_MODULES.map((m) => m.id)))
  const [drag, setDrag] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring a persisted preference after hydration
      if (raw) setEnabled(new Set(JSON.parse(raw) as string[]))
    } catch {}
  }, [])

  const toggle = (id: string) => {
    setEnabled((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))
      } catch {}
      return next
    })
  }

  const results = useMemo(() => {
    if (!fin) return null
    const p = Number(price)
    return runModules({ ...fin, price: p > 0 ? p : undefined }, enabled)
  }, [fin, price, enabled])

  async function handleFile(file: File) {
    setError(null)
    setFilings(null)
    if (file.size > MAX_BYTES) return setError('That file is larger than 40 MB.')
    if (!/\.(htm|html|xhtml)$/i.test(file.name)) {
      return setError('Please upload the EDGAR .htm filing (inline XBRL). PDFs and text files are not supported.')
    }
    setLoading(true)
    try {
      const parsed = parseIxbrl(await file.text())
      if (!isIxbrl(parsed)) throw new NotIxbrlError('This file has no inline-XBRL data. Download the main .htm document of a 2019 or later 10-K / 10-Q from EDGAR.')
      setFin(normalize(parsed))
    } catch (e) {
      setFin(null)
      setError(e instanceof Error ? e.message : 'Could not read that filing.')
    } finally {
      setLoading(false)
    }
  }

  async function searchTicker() {
    if (!ticker.trim()) return
    setError(null)
    setLoading(true)
    setFilings(null)
    try {
      const res = await fetch(`/api/edgar?ticker=${encodeURIComponent(ticker.trim())}&form=${formType}`)
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Lookup failed.')
      setFilings(body.filings)
      if (!body.filings.length) setError(`No ${formType} filings found for ${ticker.toUpperCase()}.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lookup failed.')
    } finally {
      setLoading(false)
    }
  }

  async function loadFiling(url: string) {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/edgar?url=${encodeURIComponent(url)}`)
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Could not load that filing.')
      setFin(body.financials)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load that filing.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bionis-dashboard flex h-svh overflow-hidden">
      <aside className="hidden w-72 shrink-0 flex-col gap-5 overflow-y-auto border-r bg-(--sidebar) p-4 md:flex">
        <div className="flex items-center gap-2 px-2 pt-1">
          <span className="flex size-7 items-center justify-center rounded-md bg-(--bionis-blue) text-white">
            <FileText className="size-4" />
          </span>
          <span className="text-lg font-medium tracking-tight">Filing Analyzer</span>
        </div>
        <div className="flex flex-col gap-1">
          <p className="px-2 text-xs font-medium text-muted-foreground">MODULES</p>
          {RATIO_MODULES.map((m) => (
            <label key={m.id} className="flex cursor-pointer items-start gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-background/60">
              <input type="checkbox" className="mt-1" checked={enabled.has(m.id)} onChange={() => toggle(m.id)} />
              <span className="flex flex-col">
                <span className="font-medium">{m.title}</span>
                <span className="text-xs text-muted-foreground">{m.description}</span>
              </span>
            </label>
          ))}
        </div>
        <p className="mt-auto rounded-xl border bg-background p-3 text-xs text-muted-foreground">
          Uploaded files are parsed in your browser and never sent anywhere. Ticker lookups go through this app&apos;s server to SEC EDGAR.
        </p>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-10">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-2">
            <h1 className="text-xl font-medium md:text-2xl">{fin ? fin.meta.name : 'Analyze a 10-K or 10-Q'}</h1>
            {fin ? (
              <div className="flex flex-wrap gap-2">
                <Chip className="bg-muted text-muted-foreground">
                  {fin.meta.form} {fin.meta.fiscalPeriod ? `· ${fin.meta.fiscalPeriod}` : ''} · period ending {fin.meta.periodEnd}
                </Chip>
                {fin.meta.ticker ? <Chip className="bg-muted text-muted-foreground">{fin.meta.ticker}</Chip> : null}
                {fin.basis === 'quarter' ? (
                  <Chip className="bg-(--chart-warn-bg) text-(--chart-warn)">Quarter: income ratios annualized x4; cash flow is year-to-date</Chip>
                ) : null}
                {fin.meta.sourceUrl ? (
                  <a className="text-xs underline" href={fin.meta.sourceUrl} target="_blank" rel="noreferrer">
                    Source filing
                  </a>
                ) : null}
              </div>
            ) : (
              <p className="max-w-2xl text-sm text-muted-foreground">
                Drop in an EDGAR inline-XBRL filing or look one up by ticker. The app extracts the financial statements and computes ratios, quality scores and a
                transparent rules-based screening rating, with every input traceable to its XBRL tag.
              </p>
            )}
          </div>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDrag(true)
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDrag(false)
                const f = e.dataTransfer.files[0]
                if (f) void handleFile(f)
              }}
              className={cn('flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed p-6 text-center', drag && 'bg-muted')}
            >
              <Upload className="size-5 text-muted-foreground" />
              <p className="text-sm font-medium">Drop a 10-K / 10-Q .htm file</p>
              <p className="text-xs text-muted-foreground">Main document from EDGAR, 2019 or later</p>
              <input ref={fileRef} type="file" accept=".htm,.html,.xhtml" className="hidden" onChange={(e) => e.target.files?.[0] && void handleFile(e.target.files[0])} />
              <button type="button" onClick={() => fileRef.current?.click()} className="rounded-lg border px-3 py-1.5 text-sm hover:bg-muted">
                Choose file
              </button>
            </div>

            <div className="flex flex-col gap-3 rounded-2xl border p-4">
              <p className="text-sm font-medium">Or look up by ticker</p>
              <div className="flex gap-2">
                <input
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void searchTicker()}
                  placeholder="AAPL"
                  className="h-9 w-28 rounded-lg border bg-background px-3 text-sm uppercase"
                  aria-label="Ticker"
                />
                <select value={formType} onChange={(e) => setFormType(e.target.value as '10-K' | '10-Q')} className="h-9 rounded-lg border bg-background px-2 text-sm" aria-label="Form type">
                  <option>10-K</option>
                  <option>10-Q</option>
                </select>
                <button type="button" onClick={() => void searchTicker()} className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm text-primary-foreground">
                  <Search className="size-4" /> Find
                </button>
              </div>
              {filings?.length ? (
                <ul className="flex flex-col gap-1.5">
                  {filings.map((f) => (
                    <li key={f.url}>
                      <button type="button" onClick={() => void loadFiling(f.url)} className="flex w-full items-center justify-between rounded-lg bg-muted px-3 py-2 text-left text-sm hover:bg-muted/70">
                        <span>
                          {f.form} · period {f.reportDate}
                        </span>
                        <span className="text-xs text-muted-foreground">filed {f.filingDate}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                Share price (optional, enables valuation)
                <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="e.g. 185.50" className="h-8 w-28 rounded-lg border bg-background px-2 text-sm text-foreground" />
              </label>
            </div>
          </section>

          {loading ? <p className="text-sm text-muted-foreground">Working...</p> : null}
          {error ? <p className="rounded-xl bg-(--insight-vitals)/10 px-3 py-2 text-sm text-(--insight-vitals)">{error}</p> : null}

          {fin && results ? (
            <>
              {results.rating?.rating ? <RatingCard r={results.rating.rating} /> : null}
              <section className="flex flex-col gap-3.5">
                <h2 className="text-lg font-medium">Observations</h2>
                <NoteList notes={results.notes.notes} />
              </section>
              {ALL_MODULES.filter((m) => results[m.id] && !['rating', 'notes'].includes(m.id)).map((m) => (
                <ModuleSection key={m.id} result={results[m.id]} description={m.description} />
              ))}
            </>
          ) : null}
        </div>
      </main>
    </div>
  )
}
