'use client'

import { Fragment } from 'react'
import { Check, Moon, SlidersHorizontal, Sun, Upload } from 'lucide-react'
import './terminal.css'

import { RATIO_MODULES } from '@/modules/registry'

import { cn } from '@/lib/utils'
import { FundamentalsChart, StatStrip, CHART_ITEMS, type ChartTab } from './charts'
import { scoreDepth, scoreTone, tierTone } from './format'
import { IndustryTable, MarketTable, NoteRow, RatioTable, RubricTable } from './tables'
import { Chip, Panel, Tab } from './ui'
import { ComparePanel } from './compare'
import { downloadCsv, ratiosCsv } from './export'
import { RatioBook } from './ratio-book'
import { TrendPanel } from './trend'
import { Footer } from './footer'

import { EXAMPLES, keyOf, useAnalyzer } from './use-analyzer'

export function Analyzer() {
  const {
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
    ratioRows,
    results,
    retry,
    tab,
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
    ticker,
    toggleModule,
    toggleTheme,
  } = useAnalyzer()

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
      {fin ? (
        <nav aria-label="Sections" className="sticky top-0 z-20 flex shrink-0 gap-1 border-b border-(--line) bg-(--panel) px-2 py-1 text-xs lg:hidden">
          {[['Rating', '#rating'], ['Ratios', '#ratios'], ['Chart', '#chart'], ['Appendix', '#appendix']].map(([label, href]) => (
            <a key={href} href={href} className="rounded px-2.5 py-1 text-(--muted) hover:text-(--fg)">{label}</a>
          ))}
        </nav>
      ) : null}
      <main className="grid grid-cols-1 gap-2 p-2 lg:h-[calc(100svh-4.5rem)] lg:grid-cols-[280px_minmax(0,1fr)_340px] lg:overflow-hidden">
        {/* Left: watchlist + observations */}
        <div className="flex min-h-0 flex-col gap-2 lg:overflow-y-auto">
          {history.length ? (
          <Panel title="Analyzed" className="shrink-0" right={<button type="button" onClick={clearHistory} className="text-[11px] text-(--accent) hover:underline">Clear</button>}>
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
                  <select value={formType} onChange={(e) => changeForm(e.target.value as '10-K' | '10-Q')} aria-label="Form type" className="h-8 px-2">
                    <option>10-K</option>
                    <option>10-Q</option>
                  </select>
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
                  {gapMonths > 6 ? <p className="text-[11px] text-(--muted)">This price is {gapMonths} months after the filing period, so multiples mix two dates.</p> : null}
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
              {error ? <p className="mx-3 mb-3 rounded bg-(--down-bg) px-3 py-2 text-xs text-(--down)">{error} Try another filing, or upload the .htm file.{retry ? <button type="button" onClick={() => { setRetry(null); retry() }} className="ml-2 underline">Retry</button> : null}</p> : null}
            </div>
          </Panel>

          {compared.length === 2 ? (
            <ComparePanel a={compared[0]} b={compared[1]} ra={histResults.get(compared[0]) ?? {}} rb={histResults.get(compared[1]) ?? {}} onClose={() => setCompareKeys([])} />
          ) : null}

          {fin ? (
          <Panel
            id="chart"
            title={`${fin.meta.ticker ?? ''} ${fin.meta.name}`.trim()}
            right={
              fin ? (
                <div className="flex items-center gap-2 text-[11px] text-(--muted)">
                  <Chip className="bg-(--panel-2) text-(--fg)">{fin.meta.form}{fin.meta.fiscalPeriod ? ` ${fin.meta.fiscalPeriod}` : ''}</Chip>
                  {fin.basis === 'quarter' ? <Chip className="bg-(--warn-bg) text-(--warn)" >Annualized x4</Chip> : null}
                  <span className="num">period end {fin.meta.periodEnd}</span>
                  <span>Industry</span>
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
          <Panel id="rating" title="Screening rating" className="shrink-0">
            {rating ? (
              <div className="flex flex-col gap-3 p-3">
                <div className="flex items-end justify-between">
                  <div>
                    <p className={cn('num text-4xl leading-none font-bold', scoreTone(rating.composite))}>{Math.round(rating.composite)}</p>
                    <p className="mt-1 text-[11px] text-(--muted)">{rating.used}/{rating.total} categories</p>
                    {rating.note ? <p className="text-[11px] text-(--muted)">{rating.note}</p> : null}
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
      sticky
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
