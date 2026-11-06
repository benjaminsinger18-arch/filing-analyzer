import { NextResponse } from 'next/server'
import { EdgarError, fetchFilingHtml, latestFilings, lookupCik } from '@/lib/edgar'
import { normalize, NotIxbrlError } from '@/lib/ixbrl/normalize'
import { isIxbrl, parseIxbrl } from '@/lib/ixbrl/parse'

/**
 * GET /api/edgar?ticker=AAPL&form=10-K            -> list of recent filings
 * GET /api/edgar?url=<sec archive url>            -> parsed Financials for that filing
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  try {
    const url = searchParams.get('url')
    if (url) {
      const html = await fetchFilingHtml(url)
      const parsed = parseIxbrl(html)
      if (!isIxbrl(parsed)) throw new NotIxbrlError('This filing has no inline-XBRL data (pre-2019 filings are not supported).')
      return NextResponse.json({ financials: normalize(parsed, url) })
    }
    const ticker = searchParams.get('ticker')?.trim()
    if (!ticker) return NextResponse.json({ error: 'Provide a ticker or a filing url.' }, { status: 400 })
    const form = searchParams.get('form') === '10-Q' ? ['10-Q'] : searchParams.get('form') === '10-K' ? ['10-K'] : ['10-K', '10-Q']
    const { cik, name } = await lookupCik(ticker)
    const filings = await latestFilings(cik, form)
    return NextResponse.json({ cik, name, filings })
  } catch (e) {
    if (e instanceof EdgarError) return NextResponse.json({ error: e.message }, { status: e.status })
    if (e instanceof NotIxbrlError) return NextResponse.json({ error: e.message }, { status: 422 })
    return NextResponse.json({ error: 'Unexpected error while processing the filing.' }, { status: 500 })
  }
}
