const UA_HELP =
  'Set SEC_USER_AGENT in .env.local to "Your Name your-email@example.com" (SEC requires a contact in the User-Agent).'

export class EdgarError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message)
  }
}

function headers(): HeadersInit {
  const ua = process.env.SEC_USER_AGENT
  if (!ua) throw new EdgarError(UA_HELP, 500)
  return { 'User-Agent': ua, 'Accept-Encoding': 'gzip, deflate' }
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: headers(), next: { revalidate: 3600 } })
  if (!res.ok) throw new EdgarError(`SEC request failed (${res.status}) for ${new URL(url).pathname}`, res.status === 404 ? 404 : 502)
  return (await res.json()) as T
}

export async function lookupCik(ticker: string): Promise<{ cik: string; name: string }> {
  const data = await getJson<Record<string, { cik_str: number; ticker: string; title: string }>>(
    'https://www.sec.gov/files/company_tickers.json',
  )
  const hit = Object.values(data).find((c) => c.ticker.toUpperCase() === ticker.toUpperCase())
  if (!hit) throw new EdgarError(`No SEC registrant found for ticker "${ticker}".`, 404)
  return { cik: String(hit.cik_str).padStart(10, '0'), name: hit.title }
}

export async function companyList(): Promise<{ ticker: string; name: string; cik: string }[]> {
  const data = await getJson<Record<string, { cik_str: number; ticker: string; title: string }>>(
    'https://www.sec.gov/files/company_tickers.json',
  )
  return Object.values(data).map((c) => ({ ticker: c.ticker, name: c.title, cik: String(c.cik_str).padStart(10, '0') }))
}

const periodicCache = new Map<string, { ok: boolean; at: number }>()
const PERIODIC_TTL = 6 * 60 * 60 * 1000

/** True when the registrant has filed a 10-K or 10-Q (the only forms this app analyzes). */
export async function hasPeriodicFilings(cik: string): Promise<boolean> {
  const hit = periodicCache.get(cik)
  if (hit && Date.now() - hit.at < PERIODIC_TTL) return hit.ok
  const sub = await getJson<{ filings: { recent: { form: string[] } } }>(`https://data.sec.gov/submissions/CIK${cik}.json`)
  const ok = sub.filings.recent.form.some((f) => f === '10-K' || f === '10-Q')
  periodicCache.set(cik, { ok, at: Date.now() })
  return ok
}

export type FilingRef = { form: string; filingDate: string; accession: string; primaryDocument: string; reportDate: string; url: string }

export async function latestFilings(cik: string, forms: string[], limit = 4): Promise<FilingRef[]> {
  const sub = await getJson<{
    filings: { recent: { form: string[]; filingDate: string[]; accessionNumber: string[]; primaryDocument: string[]; reportDate: string[] } }
  }>(`https://data.sec.gov/submissions/CIK${cik}.json`)
  const r = sub.filings.recent
  const out: FilingRef[] = []
  for (let i = 0; i < r.form.length && out.length < limit; i++) {
    if (!forms.includes(r.form[i])) continue
    const acc = r.accessionNumber[i]
    out.push({
      form: r.form[i],
      filingDate: r.filingDate[i],
      accession: acc,
      primaryDocument: r.primaryDocument[i],
      reportDate: r.reportDate[i],
      url: `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${acc.replace(/-/g, '')}/${r.primaryDocument[i]}`,
    })
  }
  return out
}

export async function fetchFilingHtml(url: string): Promise<string> {
  if (!url.startsWith('https://www.sec.gov/Archives/edgar/data/')) {
    throw new EdgarError('Only sec.gov EDGAR archive URLs are allowed.', 400)
  }
  const res = await fetch(url, { headers: headers(), next: { revalidate: 3600 } })
  if (!res.ok) throw new EdgarError(`Could not download the filing (${res.status}).`)
  return await res.text()
}
