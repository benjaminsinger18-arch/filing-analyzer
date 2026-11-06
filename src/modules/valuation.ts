import { div, metric } from './helpers'
import type { AnalysisModule } from './types'

/** Optional: needs a share price, which a filing does not contain. */
export const valuation: AnalysisModule = {
  id: 'valuation',
  title: 'Valuation',
  description: 'Needs a share price you enter yourself; filings do not contain market prices.',
  requires: ['epsDiluted', 'equity', 'dilutedShares', 'debt', 'cash', 'operatingIncome', 'da'],
  run(fin) {
    if (!fin.price || fin.price <= 0) {
      return {
        id: 'valuation',
        title: 'Valuation',
        metrics: [],
        notes: [{ tone: 'info', text: 'Enter a share price above to compute P/E, P/B, market cap and EV/EBITDA.' }],
      }
    }
    const price = { value: fin.price, tag: 'user input' }
    const annual = fin.basis === 'annual'
    const f = fin.annualFactor
    const shares = fin.cur.dilutedShares
    const mcap = shares ? { value: fin.price * shares.value, tag: 'price x diluted weighted shares' } : undefined
    const ebitda =
      annual && fin.ytd.operatingIncome && fin.ytd.da
        ? { value: fin.ytd.operatingIncome.value + fin.ytd.da.value, tag: 'OperatingIncomeLoss + D&A' }
        : undefined
    const ev =
      mcap && fin.bsCur.debt && fin.bsCur.cash
        ? { value: mcap.value + fin.bsCur.debt.value - fin.bsCur.cash.value, tag: 'market cap + debt - cash' }
        : undefined
    const evMetric = metric('ev-ebitda', 'EV / EBITDA', 'x', 'Enterprise value / (Operating income + D&A)',
      { 'Enterprise value': ev, EBITDA: ebitda }, (v) => (v.EBITDA <= 0 ? null : v['Enterprise value'] / v.EBITDA))
    if (!annual) evMetric.reason = 'Annual filings only'
    return {
      id: 'valuation',
      title: 'Valuation',
      notes: [
        { tone: 'info', text: 'Valuation uses diluted weighted-average shares and the price you entered. Prices move daily; this is not a price target.' },
      ],
      metrics: [
        metric('pe', 'P/E', 'x', `Price / Diluted EPS${fin.basis === 'quarter' ? ' (quarter x4)' : ''}`,
          { Price: price, 'Diluted EPS': fin.cur.epsDiluted }, (v) => (v['Diluted EPS'] <= 0 ? null : v.Price / (v['Diluted EPS'] * f))),
        metric('pb', 'P/B', 'x', "Market cap / Stockholders' equity",
          { 'Market cap': mcap, "Stockholders' equity": fin.bsCur.equity }, (v) => (v["Stockholders' equity"] <= 0 ? null : v['Market cap'] / v["Stockholders' equity"])),
        metric('mcap', 'Market cap (approx.)', 'usd', 'Price x diluted weighted shares', { 'Market cap': mcap }, (v) => v['Market cap']),
        evMetric,
        metric('fcf-yield', 'FCF yield', '%', 'Free cash flow / Market cap',
          { 'Free cash flow': fin.ytd.ocf && fin.ytd.capex ? { value: fin.ytd.ocf.value - fin.ytd.capex.value, tag: 'OCF - capex' } : undefined, 'Market cap': mcap },
          (v) => div(v['Free cash flow'], v['Market cap'])),
      ],
    }
  },
}
