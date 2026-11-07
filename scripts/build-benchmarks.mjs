// Builds src/data/industry-benchmarks.json and industry-tickers.json from Aswath Damodaran's
// US industry datasets (NYU Stern). Re-run once a year: `npm run bench:build`.
// Data: https://pages.stern.nyu.edu/~adamodar/New_Home_Page/data.html (acknowledgement requested).
import { mkdirSync, writeFileSync } from 'node:fs'
import XLSX from 'xlsx'

const BASE = 'https://pages.stern.nyu.edu/~adamodar/pc/datasets/'
const OUT = new URL('../src/data/', import.meta.url)

async function sheetRows(file) {
  const res = await fetch(BASE + file, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`)
  const wb = XLSX.read(Buffer.from(await res.arrayBuffer()), { type: 'buffer' })
  const name = wb.SheetNames.find((n) => /industry averages|by industry/i.test(n)) ?? wb.SheetNames[0]
  return { rows: XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null }), wb }
}

/** Finds the header row (first cell "Industry Name") and returns data rows keyed by industry. */
function byIndustry(rows, pick) {
  const h = rows.findIndex((r) => r[0] === 'Industry Name')
  if (h < 0) throw new Error('header row not found')
  const out = {}
  for (const r of rows.slice(h + 1)) {
    if (!r[0] || typeof r[1] !== 'number') continue
    out[r[0]] = pick(r)
  }
  return out
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

const margin = await sheetRows('margin.xls')
const vebitda = await sheetRows('vebitda.xls')
const roe = await sheetRows('roe.xls')
const dbt = await sheetRows('dbtfund.xls')
const pe = await sheetRows('pedata.xls')
const pbv = await sheetRows('pbvdata.xls')
const ps = await sheetRows('psdata.xls')
const ind = await sheetRows('indname.xls')

// Column positions verified against the January 2026 files (see header rows in each sheet).
const M = byIndustry(margin.rows, (r) => ({ firms: r[1], grossMargin: num(r[2]), netMargin: num(r[3]), operatingMargin: num(r[5]), ebitdaMargin: num(r[11]) }))
const V = byIndustry(vebitda.rows, (r) => ({ evEbitda: num(r[3]), evEbitdaAllFirms: num(r[7]) }))
const R = byIndustry(roe.rows, (r) => ({ roe: num(r[2]) }))
const D = byIndustry(dbt.rows, (r) => ({ bookDebtToCapital: num(r[2]), marketDebtToEquity: num(r[4]), interestCoverage: num(r[7]), debtToEbitda: num(r[8]) }))
const P = byIndustry(pe.rows, (r) => ({ pe: num(r[3]), trailingPe: num(r[4]), forwardPe: num(r[5]), peg: num(r[9]) }))
const B = byIndustry(pbv.rows, (r) => ({ pb: num(r[2]) }))
const S = byIndustry(ps.rows, (r) => ({ priceToSales: num(r[2]), evSales: num(r[4]) }))

const industries = {}
for (const name of Object.keys(M)) {
  industries[name] = { ...M[name], ...(V[name] ?? {}), ...(R[name] ?? {}), ...(D[name] ?? {}), ...(P[name] ?? {}), ...(B[name] ?? {}), ...(S[name] ?? {}) }
}

// Dates: Excel serial in the first sheet cell B1 ("Date updated").
const serial = margin.rows[0][1]
const asOf = new Date(Math.round((serial - 25569) * 86400 * 1000)).toISOString().slice(0, 10)

// ticker -> industry for US companies
const hdr = ind.rows[0]
const iName = hdr.indexOf('Company Name')
const iTick = hdr.indexOf('Exchange:Ticker')
const iInd = hdr.indexOf('Industry Group')
const iCountry = hdr.indexOf('Country')
const tickers = {}
for (const r of ind.rows.slice(1)) {
  if (r[iCountry] !== 'United States' || !r[iTick] || !r[iInd]) continue
  const t = String(r[iTick]).split(':').pop().toUpperCase()
  if (!t) continue
  tickers[t] = r[iInd]
  tickers[t.replace(/\./g, '-')] = r[iInd]
}

mkdirSync(OUT, { recursive: true })
const meta = {
  asOf,
  source: 'Aswath Damodaran, NYU Stern - US industry datasets (margin, vebitda, roe, dbtfund, pedata, pbvdata, psdata)',
  url: 'https://pages.stern.nyu.edu/~adamodar/New_Home_Page/data.html',
  note: 'Industry aggregates, not medians. Margins and multiples follow Damodaran definitions; operatingMargin is the pre-tax unadjusted operating margin; evEbitda uses positive-EBITDA firms only.',
}
writeFileSync(new URL('industry-benchmarks.json', OUT), JSON.stringify({ ...meta, industries }, null, 1))
writeFileSync(new URL('industry-tickers.json', OUT), JSON.stringify({ asOf, tickers }))
console.log(`asOf ${asOf}: ${Object.keys(industries).length} industries, ${Object.keys(tickers).length} US tickers`)
