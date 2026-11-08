import { describe, expect, it } from 'vitest'
import { fetchFilingHtml } from '../edgar'

describe('fetchFilingHtml', () => {
  it('rejects anything that is not an EDGAR archive URL', async () => {
    await expect(fetchFilingHtml('https://example.com/Archives/edgar/data/1/x.htm')).rejects.toThrow(/sec\.gov/)
    await expect(fetchFilingHtml('http://www.sec.gov/Archives/edgar/data/1/x.htm')).rejects.toThrow(/sec\.gov/)
    await expect(fetchFilingHtml('https://www.sec.gov/Archives/edgar/data/../../other')).rejects.toThrow(/sec\.gov/)
  })
})
