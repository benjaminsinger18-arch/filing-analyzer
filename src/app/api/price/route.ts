import { NextResponse } from 'next/server'

/**
 * GET /api/price?ticker=AAPL -> latest delayed quote.
 * Source: Yahoo Finance's unofficial chart endpoint (no API key). It is not an official API and can
 * change or rate-limit without notice; the UI labels the source and date next to the number.
 */
export async function GET(req: Request) {
  const ticker = new URL(req.url).searchParams.get('ticker')?.trim().toUpperCase() ?? ''
  if (!/^[A-Z0-9.\-]{1,10}$/.test(ticker)) {
    return NextResponse.json({ error: 'Enter a valid ticker.' }, { status: 400 })
  }
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=5d&interval=1d`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, next: { revalidate: 300 } },
    )
    if (res.status === 404) return NextResponse.json({ error: `No quote found for ${ticker}.` }, { status: 404 })
    if (!res.ok) return NextResponse.json({ error: 'Quote service unavailable. Enter a price manually.' }, { status: 502 })
    const body = (await res.json()) as {
      chart?: { result?: { meta?: { regularMarketPrice?: number; regularMarketTime?: number; currency?: string } }[] }
    }
    const meta = body.chart?.result?.[0]?.meta
    if (!meta?.regularMarketPrice) return NextResponse.json({ error: `No quote found for ${ticker}.` }, { status: 404 })
    return NextResponse.json({
      price: meta.regularMarketPrice,
      currency: meta.currency ?? 'USD',
      asOf: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString().slice(0, 10) : null,
      source: 'Yahoo Finance (unofficial, may be delayed)',
    })
  } catch {
    return NextResponse.json({ error: 'Quote service unavailable. Enter a price manually.' }, { status: 502 })
  }
}
