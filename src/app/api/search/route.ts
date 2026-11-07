import { NextResponse } from 'next/server'
import { companyList, EdgarError, hasPeriodicFilings } from '@/lib/edgar'
import { rankCompanies } from '@/lib/search'

/** GET /api/search?q=apple -> up to 8 matching SEC registrants (name or ticker, partial matches). */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get('q') ?? ''
  if (q.trim().length < 1 || q.length > 60) return NextResponse.json({ results: [] })
  try {
    const list = await companyList()
    // One entry per company (drops extra share classes, preferreds and warrants), best matches first.
    const seen = new Set<string>()
    const candidates = rankCompanies(list, q, 40).filter((c) => (seen.has(c.cik) ? false : (seen.add(c.cik), true))).slice(0, 14)
    // Keep only registrants with a 10-K or 10-Q (funds, trusts and shells have none to analyze).
    const valid: typeof candidates = []
    for (let i = 0; i < candidates.length && valid.length < 8; i += 5) {
      const batch = candidates.slice(i, i + 5)
      const checks = await Promise.all(batch.map((c) => hasPeriodicFilings(c.cik).catch(() => null)))
      batch.forEach((c, j) => {
        // If the check itself fails (SEC unavailable), keep the entry rather than hide a real company.
        if (checks[j] !== false && valid.length < 8) valid.push(c)
      })
    }
    return NextResponse.json({ results: valid })
  } catch (e) {
    console.error('company search failed', e)
    if (e instanceof EdgarError) return NextResponse.json({ error: e.message, results: [] }, { status: e.status })
    return NextResponse.json({ error: 'Search unavailable.', results: [] }, { status: 502 })
  }
}
