import { describe, expect, it } from 'vitest'
import { hasMath, splitFormula, toTex } from '../tex'

describe('toTex', () => {
  it('turns a ratio into a fraction', () => {
    expect(toTex('Gross profit / Revenue')).toBe('\\dfrac{\\text{Gross profit}}{\\text{Revenue}}')
  })
  it('keeps parenthesized numerators and denominators without extra brackets', () => {
    expect(toTex('(Net income - OCF) / Total assets')).toBe('\\dfrac{\\text{Net income} - \\text{OCF}}{\\text{Total assets}}')
    expect(toTex('Total debt / (Operating income + D&A)')).toBe('\\dfrac{\\text{Total debt}}{\\text{Operating income} + \\text{D\\&A}}')
  })
  it('handles a fraction followed by a product, and plain sums and products', () => {
    expect(toTex('Receivables / Revenue x days in period')).toBe('\\dfrac{\\text{Receivables}}{\\text{Revenue}} \\times \\text{days in period}')
    expect(toTex('DSO + DIO - DPO')).toBe('\\text{DSO} + \\text{DIO} - \\text{DPO}')
    expect(toTex('Price x diluted weighted shares')).toBe('\\text{Price} \\times \\text{diluted weighted shares}')
  })
  it("keeps apostrophes and does not split hyphenated words", () => {
    expect(toTex("Net income / Stockholders' equity")).toBe("\\dfrac{\\text{Net income}}{\\text{Stockholders' equity}}")
    expect(hasMath('Pre-tax unadjusted operating margin')).toBe(false)
  })
  it('rejects malformed input so the caller can fall back to text', () => {
    expect(() => toTex('Revenue / ')).toThrow()
    expect(() => toTex('(Revenue / Assets')).toThrow()
  })
})

describe('splitFormula', () => {
  it('separates trailing annotations from the math', () => {
    expect(splitFormula('Net income / Total assets (quarter annualized x4)')).toEqual({ math: 'Net income / Total assets', note: 'quarter annualized ×4' })
    expect(splitFormula('Free cash flow / Revenue (year-to-date)')).toEqual({ math: 'Free cash flow / Revenue', note: 'year-to-date' })
    expect(splitFormula('Debt / (debt + equity), book values')).toEqual({ math: 'Debt / (debt + equity)', note: 'book values' })
  })
})

describe('annotations', () => {
  it('moves a trailing operator-free parenthetical out of the math', () => {
    expect(splitFormula("Total assets / Stockholders' equity (DuPont leverage term)")).toEqual({ math: "Total assets / Stockholders' equity", note: 'DuPont leverage term' })
    expect(splitFormula('Total debt / (Operating income + D&A)').note).toBeUndefined()
  })
})
