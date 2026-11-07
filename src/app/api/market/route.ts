import { NextResponse } from 'next/server'
import type { MarketData, MarketRatios } from '@/lib/financials'
import { mapFinnhubFundamentals, mapFinnhubMetrics, toNum } from '@/lib/market'

/** Alpha Vantage GLOBAL_QUOTE: official latest-close price (free tier: 1 request/second, 25/day). */
async function alphaVantagePrice(ticker: string, key: string): Promise<{ price: number; asOf: string | null } | null> {
  const res = await fetch(
    `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(ticker)}&apikey=${encodeURIComponent(key)}`,
    { next: { revalidate: 300 } },
  )
  if (!res.ok) return null
  const body = (await res.json()) as { 'Global Quote'?: Record<string, string> }
  const q = body['Global Quote']
  const price = toNum(q?.['05. price'])
  if (!price || price <= 0) return null
  return { price, asOf: q?.['07. latest trading day'] ?? null }
}

/** Fallback for the price only: Yahoo Finance's unofficial chart endpoint (no key). */
async function yahooPrice(ticker: string): Promise<{ price: number; asOf: string | null } | null> {
  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=5d&interval=1d`,
    { headers: { 'User-Agent': 'Mozilla/5.0' }, next: { revalidate: 300 } },
  )
  if (!res.ok) return null
  const body = (await res.json()) as {
    chart?: { result?: { meta?: { regularMarketPrice?: number; regularMarketTime?: number } }[] }
  }
  const meta = body.chart?.result?.[0]?.meta
  if (!meta?.regularMarketPrice) return null
  return {
    price: meta.regularMarketPrice,
    asOf: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString().slice(0, 10) : null,
  }
}

/** Finnhub basic financials (free key, 60 calls/minute): provider-reported market ratios. */
async function finnhubRatios(ticker: string, key: string): Promise<{ ratios: MarketRatios; fundamentals: Record<string, number> } | { note: string }> {
  const res = await fetch(
    `https://finnhub.io/api/v1/stock/metric?symbol=${encodeURIComponent(ticker)}&metric=all&token=${encodeURIComponent(key)}`,
    { next: { revalidate: 300 } },
  )
  if (res.status === 429) return { note: 'Finnhub rate limit reached; provider ratios unavailable.' }
  if (res.status === 401 || res.status === 403) return { note: 'Finnhub rejected the API key.' }
  if (!res.ok) return { note: 'Finnhub is unavailable; provider ratios unavailable.' }
  const body = (await res.json()) as { metric?: Record<string, unknown> }
  const ratios = body.metric ? mapFinnhubMetrics(body.metric) : {}
  const fundamentals = body.metric ? mapFinnhubFundamentals(body.metric) : {}
  if (Object.keys(ratios).length === 0 && Object.keys(fundamentals).length === 0) return { note: 'No provider ratios found for this ticker.' }
  return { ratios, fundamentals }
}

/**
 * GET /api/market?ticker=AAPL -> latest price plus provider-reported market ratios.
 * Price: Alpha Vantage (ALPHAVANTAGE_API_KEY) with Yahoo fallback. Ratios: Finnhub (FINNHUB_API_KEY).
 * Called on demand only, to protect free-tier quotas.
 */
export async function GET(req: Request) {
  const ticker = new URL(req.url).searchParams.get('ticker')?.trim().toUpperCase() ?? ''
  if (!/^[A-Z0-9.\-]{1,10}$/.test(ticker)) return NextResponse.json({ error: 'Enter a valid ticker.' }, { status: 400 })
  try {
    const avKey = process.env.ALPHAVANTAGE_API_KEY
    const fhKey = process.env.FINNHUB_API_KEY

    const [av, fh] = await Promise.all([
      avKey ? alphaVantagePrice(ticker, avKey) : Promise.resolve(null),
      fhKey ? finnhubRatios(ticker, fhKey) : Promise.resolve({ note: 'Set FINNHUB_API_KEY to load provider ratios (free key at finnhub.io).' }),
    ])

    let price = av?.price
    let priceAsOf = av?.asOf ?? null
    let source = av ? 'Alpha Vantage (latest trading day close)' : ''
    if (price === undefined) {
      const y = await yahooPrice(ticker)
      if (y) {
        price = y.price
        priceAsOf = y.asOf
        source = 'Yahoo Finance (unofficial, may be delayed)'
      }
    }
    if (price === undefined) return NextResponse.json({ error: `No quote found for ${ticker}.` }, { status: 404 })

    const data: MarketData = {
      ticker,
      price,
      priceAsOf,
      source,
      ratios: 'ratios' in fh ? fh.ratios : {},
      fundamentals: 'fundamentals' in fh ? fh.fundamentals : undefined,
      ratiosNote: 'note' in fh ? fh.note : undefined,
    }
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Market data unavailable. Enter a price manually.' }, { status: 502 })
  }
}
