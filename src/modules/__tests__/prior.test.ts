import { describe, expect, it } from 'vitest'
import { buildFixture } from '@/lib/ixbrl/__tests__/fixture'
import { normalize } from '@/lib/ixbrl/normalize'
import { parseIxbrl } from '@/lib/ixbrl/parse'
import { deltaLabel, deltaTone } from '@/components/analyzer/ratio-book'
import { ratiosCsv } from '@/components/analyzer/export'
import type { Metric } from '../types'
import { priorValues } from '../prior'

const m = (over: Partial<Metric>): Metric => ({ id: 'gross-margin', label: 'Gross margin', unit: '%', value: 0.4, formula: 'a / b', inputs: [], ...over }) as Metric

describe('prior-year values', () => {
  it('recomputes ratios on the prior-year figures', () => {
    const fin = normalize(parseIxbrl(buildFixture()))
    const p = priorValues(fin)
    expect(Object.keys(p).length).toBeGreaterThan(3)
    expect(p['rev-growth']).toBeUndefined()
  })
})

describe('ratio book change', () => {
  it('shows points for percent metrics and hides zero change', () => {
    expect(deltaLabel(m({ value: 0.42 }), 0.4)?.text).toBe('+2.0 pts')
    expect(deltaLabel(m({ value: 0.4 }), 0.4)).toBeNull()
    expect(deltaLabel(m({ value: null }), 0.4)).toBeNull()
  })
  it('colors by the favorable direction, not the sign', () => {
    expect(deltaTone('gross-margin', 1)).toBe('text-(--up)')
    expect(deltaTone('debt-equity', 1)).toBe('text-(--down)')
    expect(deltaTone('debt-equity', -1)).toBe('text-(--up)')
    expect(deltaTone('capex-intensity', 1)).toBe('text-(--muted)')
  })
})

describe('csv export', () => {
  it('quotes cells that contain commas', () => {
    const csv = ratiosCsv([{ moduleTitle: 'Profitability', m: m({ formula: 'a, b' }) }])
    expect(csv.split('\n')[1]).toContain('"a, b"')
  })
})
