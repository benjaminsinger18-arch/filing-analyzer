import { NextResponse } from 'next/server'
import { companyList, EdgarError } from '@/lib/edgar'
import { rankCompanies } from '@/lib/search'

/** GET /api/search?q=apple -> up to 8 matching SEC registrants (name or ticker, partial matches). */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get('q') ?? ''
  if (q.trim().length < 1 || q.length > 60) return NextResponse.json({ results: [] })
  try {
    const list = await companyList()
    return NextResponse.json({ results: rankCompanies(list, q) })
  } catch (e) {
    console.error('company search failed', e)
    if (e instanceof EdgarError) return NextResponse.json({ error: e.message, results: [] }, { status: e.status })
    return NextResponse.json({ error: 'Search unavailable.', results: [] }, { status: 502 })
  }
}
