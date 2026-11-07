import { NextResponse } from 'next/server'

type Quote = { price: number; currency: string; asOf: string | null; source: string }

/** Alpha Vantage GLOBAL_QUOTE (official, needs ALPHAVANTAGE_API_KEY; free tier is 25 requests/day). */
async function alphaVantage(ticker: string, key: string): Promise<Quote | 'limit' | null> {
  const res = await fetch(
    `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(ticker)}&apikey=${encodeURIComponent(key)}`,
    { next: { revalidate: 300 } },
  )
  if (!res.ok) return null
  const body = (await res.json()) as {
    'Global Quote'?: Record<string, string>
    Note?: string
    Information?: string
  }
  if (body.Note || body.Information) return 'limit'
  const q = body['Global Quote']
  const price = Number(q?.['05. price'])
  if (!q || !Number.isFinite(price) || price <= 0) return null
  return { price, currency: 'USD', asOf: q['07. latest trading day'] ?? null, source: 'Alpha Vantage (latest trading day close)' }
}

/** Fallback: Yahoo Finance's unofficial chart endpoint (no key, can change or rate-limit without notice). */
async function yahoo(ticker: string): Promise<Quote | null> {
  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=5d&interval=1d`,
    { headers: { 'User-Agent': 'Mozilla/5.0' }, next: { revalidate: 300 } },
  )
  if (!res.ok) return null
  const body = (await res.json()) as {
    chart?: { result?: { meta?: { regularMarketPrice?: number; regularMarketTime?: number; currency?: string } }[] }
  }
  const meta = body.chart?.result?.[0]?.meta
  if (!meta?.regularMarketPrice) return null
  return {
    price: meta.regularMarketPrice,
    currency: meta.currency ?? 'USD',
    asOf: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString().slice(0, 10) : null,
    source: 'Yahoo Finance (unofficial, may be delayed)',
  }
}

/** GET /api/price?ticker=AAPL -> latest quote. Alpha Vantage when a key is set, otherwise (or if rate-limited) Yahoo. */
export async function GET(req: Request) {
  const ticker = new URL(req.url).searchParams.get('ticker')?.trim().toUpperCase() ?? ''
  if (!/^[A-Z0-9.\-]{1,10}$/.test(ticker)) {
    return NextResponse.json({ error: 'Enter a valid ticker.' }, { status: 400 })
  }
  try {
    const key = process.env.ALPHAVANTAGE_API_KEY
    let quote: Quote | null = null
    if (key) {
      const av = await alphaVantage(ticker, key)
      if (av && av !== 'limit') quote = av
    }
    if (!quote) quote = await yahoo(ticker)
    if (!quote) return NextResponse.json({ error: `No quote found for ${ticker}.` }, { status: 404 })
    return NextResponse.json(quote)
  } catch {
    return NextResponse.json({ error: 'Quote service unavailable. Enter a price manually.' }, { status: 502 })
  }
}
