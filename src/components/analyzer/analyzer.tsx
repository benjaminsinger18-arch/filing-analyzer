'use client'

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Moon, Search, SlidersHorizontal, Sun, Upload } from 'lucide-react'
import './terminal.css'
import type { Financials, IndustryBenchmark, MarketData } from '@/lib/financials'
import { normalize, NotIxbrlError } from '@/lib/ixbrl/normalize'
import { isIxbrl, parseIxbrl } from '@/lib/ixbrl/parse'
import { RATIO_MODULES, runModules } from '@/modules/registry'
import type { Company } from '@/lib/search'
import { cn } from '@/lib/utils'
import { FundamentalsChart, StatStrip, CHART_ITEMS, type ChartTab } from './charts'
import { scoreDepth, scoreTone, tierTone } from './format'
import { IndustryTable, MarketTable, NoteRow, RatioTable, RubricTable, industryRowVisible } from './tables'
import { Chip, Panel, Tab } from './ui'
import { ComparePanel } from './compare'
import { downloadCsv, ratiosCsv } from './export'
import { RatioBook } from './ratio-book'
import { TrendPanel, seriesFor } from './trend'
import { Footer } from './footer'
import { priorValues } from '@/modules/prior'

const MAX_BYTES = 40 * 1024 * 1024
const STORAGE_KEY = 'analyzer.disabledModules'
const THEME_KEY = 'analyzer.theme'
const HISTORY_KEY = 'analyzer.history'
const HISTORY_MAX = 12
const keyOf = (f: Financials) => `${f.meta.name}|${f.meta.form}|${f.meta.periodEnd}`
const EXAMPLES = ['AAPL', 'MSFT', 'KO', 'JPM', 'TSLA', 'XOM']

type FilingRef = { form: string; filingDate: string; reportDate: string; url: string }
type BottomTab = 'ratios' | 'industry' | 'market' | 'rubric' | 'filing'

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
  const [compareKeys, setCompareKeys] = useState<string[]>([])
  const [bulkNote, setBulkNote] = useState<string | null>(null)
  const historyReady = useRef(false)
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

  // Analyzed filings survive a reload (parsed figures only, no market or industry data).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY)
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring persisted history after hydration
      if (raw) setHistory(JSON.parse(raw) as Financials[])
    } catch {}
    historyReady.current = true
  }, [])

  useEffect(() => {
    if (!historyReady.current) return
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
    } catch {}
  }, [history])

  // Restore a shared link (?t=AAPL&url=<filing>) once after hydration.
  const restored = useRef(false)
  useEffect(() => {
    if (restored.current) return
    restored.current = true
    const q = new URLSearchParams(window.location.search)
    const t = q.get('t')
    const url = q.get('url')
    if (t) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring state from the URL after hydration
      setTicker(t)
      setSymbol(t)
    }
    if (url) void loadFiling(url)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sourceUrl = fin?.meta.sourceUrl
  const metaTicker = fin?.meta.ticker
  useEffect(() => {
    if (!fin || !restored.current) return
    const q = new URLSearchParams()
    if (metaTicker) q.set('t', metaTicker)
    if (sourceUrl) q.set('url', sourceUrl)
    window.history.replaceState(null, '', q.size ? `?${q}` : window.location.pathname)
  }, [fin, metaTicker, sourceUrl])

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
    addHistory(f)
  }

  function addHistory(f: Financials) {
    setHistory((h) =>
      [f, ...h.filter((x) => keyOf(x) !== keyOf(f))]
        .sort((a, b) => b.meta.periodEnd.localeCompare(a.meta.periodEnd) || a.meta.name.localeCompare(b.meta.name))
        .slice(0, HISTORY_MAX),
    )
  }

  /** Loads the most recent filings in the list into the history (for trends) without changing the open filing. */
  async function loadMany(list: FilingRef[]) {
    const todo = list.slice(0, 5)
    let done = 0
    for (const f of todo) {
      setBulkNote(`Loading ${done + 1} of ${todo.length}...`)
      try {
        const res = await fetch(`/api/edgar?url=${encodeURIComponent(f.url)}`)
        const body = await res.json()
        if (res.ok) addHistory(body.financials)
      } catch {}
      done++
    }
    setBulkNote(null)
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

  /** Example button: look up the ticker and open its latest 10-K. */
  async function quickStart(sym: string) {
    setTicker(sym)
    setSymbol(sym)
    setFormType('10-K')
    setError(null)
    setLoading(true)
    setFilings(null)
    try {
      const res = await fetch(`/api/edgar?ticker=${sym}&form=10-K`)
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Lookup failed.')
      const list = [...(body.filings as FilingRef[])].sort((a, b) => b.reportDate.localeCompare(a.reportDate))
      setFilings(list)
      if (list[0]) await loadFiling(list[0].url)
      else setError(body.note ?? `No 10-K filings found for ${sym}.`)
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

  const histResults = useMemo(() => new Map(history.map((h) => [h, runModules(h)] as const)), [history])
  const priorMap = useMemo(() => (fin ? priorValues(fin) : {}), [fin])
  const rating = results?.rating?.rating
  const scored = (rating?.categories ?? []).filter((c) => c.score !== null).sort((a, b) => (b.score as number) - (a.score as number))
  const ratingSummary = scored.length >= 2 ? `Strongest: ${scored[0].label}. Weakest: ${scored[scored.length - 1].label}.` : null
  const industryRows = results?.industry?.metrics.filter(industryRowVisible).length ?? 0
  const marketRows = results?.market?.metrics.length ?? 0
  const tab: BottomTab = (bottomTab === 'industry' && !industryRows) || (bottomTab === 'market' && !marketRows) ? 'ratios' : bottomTab
  const allMetrics = results
    ? RATIO_MODULES.filter((m) => results[m.id] && enabled.has(m.id) && m.id !== 'industry' && m.id !== 'market').flatMap((m) => results[m.id].metrics.map((metric) => ({ moduleTitle: m.title, m: metric })))
    : []
  const book = allMetrics.filter(({ m }) => m.value !== null)
  const ratioRows = allMetrics.filter(({ m }) => m.value !== null)
  const ratingOf = (f: Financials) => {
    const r = histResults.get(f)?.rating?.rating
    return r?.composite == null ? null : Math.round(r.composite)
  }
  const compared = compareKeys.map((k) => history.find((h) => keyOf(h) === k)).filter((h): h is Financials => !!h)
  const series = fin ? seriesFor(fin, history, histResults) : []

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
            <span className="text-base font-bold tracking-wide">FILING ANALYZER</span>
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
                        <tr key={`${h.meta.name}${h.meta.form}${h.meta.periodEnd}`} onClick={() => setFin(h)} onKeyDown={(e) => { if (e.key === 'Enter') setFin(h) }} tabIndex={0} aria-selected={active} className={cn('cursor-pointer border-t border-(--line) hover:bg-(--panel-2)', active && 'bg-(--accent)/15 shadow-[inset_4px_0_0_var(--accent)]')}>
                          <td className="px-3 py-1.5">
                            <input
                              type="checkbox"
                              aria-label={`Compare ${h.meta.ticker ?? h.meta.name} ${h.meta.form} ${h.meta.periodEnd}`}
                              checked={compareKeys.includes(keyOf(h))}
                              onClick={(e) => e.stopPropagation()}
                              onChange={() => setCompareKeys((c) => (c.includes(keyOf(h)) ? c.filter((k) => k !== keyOf(h)) : [...c, keyOf(h)].slice(-2)))}
                              className="float-left mt-1 mr-2"
                            />
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
        </div>

        {/* Center: header, chart, loader, tables */}
        <div className="flex min-h-0 flex-col gap-2 lg:overflow-y-auto">
          <Panel title="Load filing" className="shrink-0">
            <div className="grid grid-cols-1 gap-3 p-3 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold">Search company or ticker</p>
                <div className="flex flex-wrap gap-2">
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
                {filings && filings.length > 1 && filings[0].form === '10-K' ? (
                  <div className="flex items-center gap-2 text-[11px] text-(--muted)">
                    <button type="button" disabled={!!bulkNote} onClick={() => void loadMany(filings)} className="rounded border border-(--line) px-2 py-0.5 text-xs text-(--accent) hover:bg-(--panel-2) disabled:opacity-50">Load last 5 for trends</button>
                    {bulkNote}
                  </div>
                ) : null}
                {!fin && !filings?.length ? (
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-(--muted)">
                    Try
                    {EXAMPLES.map((sym) => (
                      <button key={sym} type="button" onClick={() => void quickStart(sym)} className="num rounded border border-(--line) px-2 py-0.5 text-xs text-(--accent) hover:bg-(--panel-2)">{sym}</button>
                    ))}
                  </div>
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
            <div role="status" aria-live="polite">
              {loading ? (
                <div className="px-3 pb-3">
                  <p className="mb-1.5 text-xs text-(--muted)">Loading...</p>
                  <div className="h-1 animate-pulse rounded bg-(--accent)/40" />
                </div>
              ) : null}
            </div>
            <div role="alert">
              {error ? <p className="mx-3 mb-3 rounded bg-(--down-bg) px-3 py-2 text-xs text-(--down)">{error} Try another filing, or upload the .htm file.</p> : null}
            </div>
          </Panel>

          {compared.length === 2 ? (
            <ComparePanel a={compared[0]} b={compared[1]} ra={histResults.get(compared[0]) ?? {}} rb={histResults.get(compared[1]) ?? {}} onClose={() => setCompareKeys([])} />
          ) : null}

          {fin ? (
          <Panel
            title={`${fin.meta.ticker ?? ''} ${fin.meta.name}`.trim()}
            right={
              fin ? (
                <div className="flex items-center gap-2 text-[11px] text-(--muted)">
                  <Chip className="bg-(--panel-2) text-(--fg)">{fin.meta.form}{fin.meta.fiscalPeriod ? ` ${fin.meta.fiscalPeriod}` : ''}</Chip>
                  {fin.basis === 'quarter' ? <Chip className="bg-(--warn-bg) text-(--warn)" >Annualized x4</Chip> : null}
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
            className="min-h-136 flex-1"
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

          <TrendPanel series={series} />
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
                    {rating.providerInputs > 0 ? <p className="text-[11px] text-(--muted)">{rating.providerInputs} input{rating.providerInputs > 1 ? 's' : ''} from Finnhub</p> : null}
                  </div>
                  <Chip className={cn('text-sm', tierTone[rating.tier])}>{rating.tier}</Chip>
                </div>
                {ratingSummary ? <p className="text-xs text-(--muted)">{ratingSummary}</p> : null}
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

          {results && results.notes.notes.length ? (
          <Panel title="Observations" className="min-h-40 flex-1">
            <ul className="min-h-0 overflow-y-auto">
              {results.notes.notes.map((n, i) => <NoteRow key={i} n={n} />)}
            </ul>
          </Panel>
          ) : null}
          {book.length ? <RatioBook rows={book} prior={priorMap} industry={results?.industry} /> : null}
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
          {tab === 'ratios' && ratioRows.length ? (
            <button type="button" onClick={() => downloadCsv(`${fin?.meta.ticker ?? 'filing'}-ratios.csv`, ratiosCsv(ratioRows))} className="rounded px-2.5 py-1 text-xs text-(--accent) hover:bg-(--panel-2)">CSV</button>
          ) : null}
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
      <Footer />
      </div>
    </div>
  )
}
