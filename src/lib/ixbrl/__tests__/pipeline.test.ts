import { describe, expect, it } from 'vitest'
import { normalize } from '../normalize'
import { parseIxbrl, toIsoDate } from '../parse'
import { runModules } from '@/modules/registry'
import { piotroski } from '@/modules/scores'
import { buildFixture } from './fixture'

const M = 1e6

describe('parseIxbrl', () => {
  it('applies scale, reads cover facts and flags dimensional contexts', () => {
    const p = parseIxbrl(buildFixture())
    expect(p.cover['dei:DocumentType']).toBe('10-K')
    expect(p.cover['dei:DocumentPeriodEndDate']).toBe('December 31, 2024')
    const rev = p.facts.find((f) => f.name.includes('Revenue') && f.contextRef === 'FY24')!
    expect(rev.value).toBe(1000 * M)
    expect(p.contexts.SEG24.dimensional).toBe(true)
    expect(p.contexts.FY24.period).toEqual({ start: '2024-01-01', end: '2024-12-31' })
  })

  it('honours sign="-" and fixed-zero formats', () => {
    const html = `<ix:header><ix:resources><xbrli:context id="c"><xbrli:period><xbrli:instant>2024-12-31</xbrli:instant></xbrli:period></xbrli:context></ix:resources></ix:header>
      <ix:nonFraction name="us-gaap:Foo" contextRef="c" unitRef="usd" scale="3" sign="-">1,500</ix:nonFraction>
      <ix:nonFraction name="us-gaap:Bar" contextRef="c" unitRef="usd" format="ixt:fixed-zero">-</ix:nonFraction>`
    const p = parseIxbrl(html)
    expect(p.facts.find((f) => f.name === 'us-gaap:Foo')!.value).toBe(-1_500_000)
    expect(p.facts.find((f) => f.name === 'us-gaap:Bar')!.value).toBe(0)
  })

  it('converts long dates', () => {
    expect(toIsoDate('September 28, 2024')).toBe('2024-09-28')
    expect(toIsoDate('2024-09-28')).toBe('2024-09-28')
  })
})

describe('normalize', () => {
  const fin = normalize(parseIxbrl(buildFixture()))

  it('uses consolidated (non-dimensional) values and picks current and prior periods', () => {
    expect(fin.basis).toBe('annual')
    expect(fin.meta.periodEnd).toBe('2024-12-31')
    expect(fin.cur.revenue?.value).toBe(1000 * M)
    expect(fin.prior.revenue?.value).toBe(800 * M)
    expect(fin.bsCur.assets?.value).toBe(2000 * M)
    expect(fin.bsPrior.assets?.value).toBe(1800 * M)
    expect(fin.cur.grossProfit?.tag).toMatch(/derived/)
    expect(fin.cur.grossProfit?.value).toBe(400 * M)
    expect(fin.ytd.ocf?.value).toBe(180 * M)
  })
})

describe('modules', () => {
  const fin = normalize(parseIxbrl(buildFixture()))
  const results = runModules(fin)
  const val = (id: string) => Object.values(results).flatMap((r) => r.metrics).find((m) => m.id === id)!

  it('computes ratios that match hand calculations', () => {
    expect(val('gross-margin').value).toBeCloseTo(0.4)
    expect(val('operating-margin').value).toBeCloseTo(0.2)
    expect(val('roa').value).toBeCloseTo(150 / 2000)
    expect(val('roe').value).toBeCloseTo(150 / 1100)
    expect(val('current-ratio').value).toBeCloseTo(2)
    expect(val('quick-ratio').value).toBeCloseTo(1.75)
    expect(val('debt-equity').value).toBeCloseTo(400 / 1100)
    expect(val('interest-coverage').value).toBeCloseTo(20)
    expect(val('rev-growth').value).toBeCloseTo(0.25)
    expect(val('ocf-ni').value).toBeCloseTo(1.2)
    expect(val('fcf').value).toBe(140 * M)
    expect(val('dso').value).toBeCloseTo((150 / 1000) * 365)
    expect(val('ccc').value).toBeCloseTo((150 / 1000) * 365 + (100 / 600) * 365 - (80 / 600) * 365)
  })

  it('computes Altman Z-double-prime', () => {
    const z = 6.56 * (400 / 2000) + 3.26 * (500 / 2000) + 6.72 * (200 / 2000) + 1.05 * (1100 / 900)
    expect(val('altman').value).toBeCloseTo(z)
  })

  it('scores all nine Piotroski tests for the fixture', () => {
    const p = piotroski(fin)
    // gross margin: 400/1000 = .40 vs 300/800 = .375 (pass); turnover 1000/2000=.5 vs 800/1800=.444 (pass)
    expect(p.tests.filter((t) => t.pass === null).map((t) => t.name)).toEqual([])
    expect(p.score).toBe(9)
  })

  it('produces a rating from the available categories', () => {
    const r = results.rating.rating!
    expect(r.used).toBe(5)
    expect(r.tier).toBe('Strong')
  })

  it('shows n/a with a reason instead of zero when inputs are missing', () => {
    const bank = normalize(parseIxbrl(buildFixture().replace(/<ix:nonFraction name="us-gaap:AccountsReceivableNetCurrent"[^<]*<\/ix:nonFraction>/, '')))
    const m = Object.values(runModules(bank)).flatMap((r) => r.metrics).find((x) => x.id === 'dso')!
    expect(m.value).toBeNull()
    expect(m.reason).toMatch(/Not reported/)
  })

  it('flags an operating loss in the notes', () => {
    const loss = normalize(parseIxbrl(buildFixture({ oi24: '-50' })))
    const text = runModules(loss).notes.notes.map((n) => n.text).join(' ')
    expect(text).toMatch(/operating loss/)
  })
})
