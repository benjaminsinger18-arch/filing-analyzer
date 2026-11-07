import { describe, expect, it } from 'vitest'
import { rankCompanies, type Company } from '../search'

const c = (ticker: string, name: string): Company => ({ ticker, name, cik: '0' })
// Order mimics the SEC list: larger companies first.
const LIST: Company[] = [
  c('NVDA', 'NVIDIA CORP'),
  c('AAPL', 'Apple Inc.'),
  c('MSFT', 'MICROSOFT CORP'),
  c('GOOGL', 'Alphabet Inc.'),
  c('AMZN', 'AMAZON COM INC'),
  c('AMD', 'ADVANCED MICRO DEVICES INC'),
  c('APLE', 'Apple Hospitality REIT, Inc.'),
  c('KO', 'COCA COLA CO'),
  c('BRK-B', 'BERKSHIRE HATHAWAY INC'),
  c('T', 'AT&T INC.'),
]

const top = (q: string) => rankCompanies(LIST, q).map((x) => x.ticker)

describe('rankCompanies', () => {
  it('puts an exact ticker first', () => {
    expect(top('aapl')[0]).toBe('AAPL')
    expect(top('t')[0]).toBe('T')
  })
  it('matches company names without an exact match', () => {
    expect(top('apple')).toEqual(['AAPL', 'APLE'])
    expect(top('micro')[0]).toBe('MSFT')
    expect(top('coca cola')[0]).toBe('KO')
    expect(top('berkshire')[0]).toBe('BRK-B')
  })
  it('matches a ticker prefix and handles punctuation in names', () => {
    expect(top('am')).toContain('AMZN')
    expect(top('at&t')[0]).toBe('T')
    expect(top('alphabet')[0]).toBe('GOOGL')
  })
  it('needs every word of the query to match', () => {
    expect(top('apple hospitality')).toEqual(['APLE'])
    expect(top('apple banana')).toEqual([])
  })
  it('returns nothing for an empty query and respects the limit', () => {
    expect(top('   ')).toEqual([])
    expect(rankCompanies(LIST, 'a', 3)).toHaveLength(3)
  })
})
