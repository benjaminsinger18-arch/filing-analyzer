'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import './terminal.css'
import type { Financials, IndustryBenchmark, MarketData } from '@/lib/financials'
import { normalize, NotIxbrlError } from '@/lib/ixbrl/normalize'
import { isIxbrl, parseIxbrl } from '@/lib/ixbrl/parse'
import { RATIO_MODULES, runModules } from '@/modules/registry'
import type { Company } from '@/lib/search'

import { type ChartTab } from './charts'

import { industryRowVisible } from './tables'

import { seriesFor } from './trend'

import { priorValues } from '@/modules/prior'

const MAX_BYTES = 40 * 1024 * 1024
const STORAGE_KEY = 'analyzer.disabledModules'
const THEME_KEY = 'analyzer.theme'
const HISTORY_KEY = 'analyzer.history'
const HISTORY_MAX = 12
export const keyOf = (f: Financials) => `${f.meta.name}|${f.meta.form}|${f.meta.periodEnd}`
export const EXAMPLES = ['AAPL', 'MSFT', 'KO', 'JPM', 'TSLA', 'XOM']

export type FilingRef = { form: string; filingDate: string; reportDate: string; url: string }
export type BottomTab = 'ratios' | 'industry' | 'market' | 'rubric' | 'filing'

export function useAnalyzer() {
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
  const [retry, setRetry] = useState<(() => void) | null>(null)
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
    const tabParam = q.get('tab')
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring state from the URL after hydration
    if (tabParam && ['industry', 'market', 'rubric', 'filing'].includes(tabParam)) setBottomTab(tabParam as BottomTab)
    if (t) {
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
    if (bottomTab !== 'ratios') q.set('tab', bottomTab)
    window.history.replaceState(null, '', q.size ? `?${q}` : window.location.pathname)
  }, [fin, metaTicker, sourceUrl, bottomTab])

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

  function clearHistory() {
    setHistory([])
    setCompareKeys([])
    try {
      localStorage.removeItem(HISTORY_KEY)
    } catch {}
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

  /** Enter: take the highlighted or top suggestion unless the text is already an exact ticker. */
  function submit() {
    const s = suggest[active] ?? suggest[0]
    if (s && suggestOpen && (active >= 0 || ticker.trim().toUpperCase() !== s.ticker)) return pick(s)
    void searchTicker()
  }

  /** Switching 10-K / 10-Q re-runs the lookup for the company already chosen. */
  function changeForm(f: '10-K' | '10-Q') {
    setFormType(f)
    const t = symbol ?? fin?.meta.ticker ?? (filings ? ticker.trim() : '')
    if (t) void searchTicker(t, f)
  }

  async function searchTicker(sym?: string, form: '10-K' | '10-Q' = formType) {
    const t = (sym ?? ticker).trim()
    if (!t) return
    setError(null)
    setLoading(true)
    setFilings(null)
    try {
      const res = await fetch(`/api/edgar?ticker=${encodeURIComponent(t)}&form=${form}`)
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Lookup failed.')
      setFilings([...(body.filings as FilingRef[])].sort((a, b) => b.reportDate.localeCompare(a.reportDate)))
      if (!body.filings.length) setError(body.note ?? `No ${form} filings found for ${t.toUpperCase()}.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lookup failed.')
      setRetry(() => () => void searchTicker(sym, form))
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
      const res = await fetch(`/api/edgar?ticker=${encodeURIComponent(sym)}&form=10-K`)
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
      setRetry(() => () => void loadFiling(url))
    } finally {
      setLoading(false)
    }
  }

  const histResults = useMemo(() => new Map(history.map((h) => [h, runModules(h)] as const)), [history])
  const priorMap = useMemo(() => (fin ? priorValues(fin) : {}), [fin])
  const gapMonths =
    fin && market?.priceAsOf ? Math.round((new Date(market.priceAsOf).getTime() - new Date(fin.meta.periodEnd).getTime()) / (30.44 * 864e5)) : 0
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
  const ratingOf = (f: Financials) => {
    const r = histResults.get(f)?.rating?.rating
    return r?.composite == null ? null : Math.round(r.composite)
  }
  const compared = compareKeys.map((k) => history.find((h) => keyOf(h) === k)).filter((h): h is Financials => !!h)
  const series = fin ? seriesFor(fin, history, histResults) : []

  return {
    active,
    book,
    bulkNote,
    chartTab,
    clearHistory,
    compareKeys,
    compared,
    dark,
    disableAllModules,
    drag,
    enableAllModules,
    enabled,
    error,
    fetchMarket,
    fileRef,
    filings,
    fin,
    formType,
    changeForm,
    gapMonths,
    handleFile,
    histResults,
    history,
    industry,
    industryOptions,
    industryRows,
    loadFiling,
    loadIndustry,
    loadMany,
    loading,
    marketRows,
    pick,
    price,
    priceNote,
    priorMap,
    quickStart,
    rating,
    ratingOf,
    ratingSummary,
    ratioRows: book,
    results,
    retry,
    series,
    setActive,
    setBottomTab,
    setChartTab,
    setCompareKeys,
    setDrag,
    setFin,
    setPrice,
    setPriceNote,
    setRetry,
    setSuggest,
    setSuggestOpen,
    setSymbol,
    setTicker,
    submit,
    suggest,
    suggestOpen,
    symbol,
    tab,
    ticker,
    toggleModule,
    toggleTheme,
  }
}
