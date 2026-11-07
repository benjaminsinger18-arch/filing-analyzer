import { NextResponse } from 'next/server'
import benchmarks from '@/data/industry-benchmarks.json'
import tickerData from '@/data/industry-tickers.json'
import type { IndustryBenchmark } from '@/lib/financials'

type Row = Record<string, number | null>
const industries = benchmarks.industries as unknown as Record<string, Row & { firms: number }>
const tickers = tickerData.tickers as Record<string, string>

function build(name: string): IndustryBenchmark | null {
  const row = industries[name]
  if (!row) return null
  const { firms, ...values } = row
  const financial = /bank|insurance|brokerage|investments|reinsurance|financial|r\.e\.i\.t|real estate/i.test(name)
  const marketName = financial ? 'Total Market' : 'Total Market (without financials)'
  const m = industries[marketName]
  let market: IndustryBenchmark['market']
  if (m) {
    const { firms: mFirms, ...mValues } = m
    market = { name: marketName, firms: mFirms, values: mValues }
  }
  return { name, asOf: benchmarks.asOf, firms, values, market }
}

/**
 * GET /api/industry?ticker=AAPL  -> matched industry benchmark (or null) + all industry names
 * GET /api/industry?name=Software%20(System%20%26%20Application) -> that industry's benchmark
 */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams
  const options = Object.keys(industries).filter((n) => !n.startsWith('Total Market'))
  const name = sp.get('name')
  const ticker = sp.get('ticker')?.trim().toUpperCase()
  const resolved = name ?? (ticker ? (tickers[ticker] ?? tickers[ticker.replace(/\./g, '-')]) : undefined)
  return NextResponse.json({
    industry: resolved ? build(resolved) : null,
    options,
    source: { name: benchmarks.source, url: benchmarks.url, note: benchmarks.note },
  })
}
