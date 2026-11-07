export type Company = { ticker: string; name: string; cik: string }

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[.,&'’()\-/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Ranks companies for a free-text query (name words, name prefix, or ticker).
 * Every query token must match; exact ticker beats ticker prefix beats name prefix beats a word
 * prefix beats a substring. Ties keep the input order (SEC lists larger companies first).
 */
export function rankCompanies(list: Company[], query: string, limit = 8): Company[] {
  const q = norm(query)
  if (!q) return []
  const tokens = q.split(' ')
  const scored: { c: Company; score: number; i: number }[] = []
  list.forEach((c, i) => {
    const tickerL = c.ticker.toLowerCase()
    const nameN = norm(c.name)
    const words = nameN.split(' ')
    let score = 0
    for (const t of tokens) {
      let s = 0
      // Ticker matches only count for a single-word query, so "at&t" does not match every "AT..." ticker.
      if (tokens.length === 1 && tickerL === t) s = 100
      else if (words.includes(t)) s = 70
      else if (tokens.length === 1 && tickerL.startsWith(t)) s = 60
      else if (t.length > 1 && words.some((w) => w.startsWith(t))) s = 50 // one-letter words must match exactly
      else if (t.length >= 3 && nameN.includes(t)) s = 20
      if (s === 0) return // every token must match
      score += s
    }
    if (tickerL === q) score += 1000
    else if (nameN.startsWith(q)) score += 150
    scored.push({ c, score, i })
  })
  scored.sort((a, b) => b.score - a.score || a.i - b.i)
  const seen = new Set<string>()
  const out: Company[] = []
  for (const { c } of scored) {
    if (seen.has(c.ticker)) continue
    seen.add(c.ticker)
    out.push(c)
    if (out.length >= limit) break
  }
  return out
}
