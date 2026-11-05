import type { InputMap, Metric, Unit } from './types'

/**
 * Build a Metric from named inputs. Returns a null-valued metric with a reason when an input is
 * missing or the result is not a finite number, so the UI shows "n/a" instead of 0 or NaN.
 */
export function metric(
  id: string,
  label: string,
  unit: Unit,
  formula: string,
  inputs: InputMap,
  fn: (v: Record<string, number>) => number | null,
  hint?: string,
): Metric {
  const missing = Object.entries(inputs)
    .filter(([, v]) => !v)
    .map(([k]) => k)
  const base = { id, label, unit, formula, hint }
  if (missing.length) {
    return { ...base, value: null, inputs: [], reason: `Not reported in this filing: ${missing.join(', ')}` }
  }
  const nums: Record<string, number> = {}
  const list = Object.entries(inputs).map(([k, v]) => {
    nums[k] = v!.value
    return { label: k, value: v!.value, tag: v!.tag }
  })
  const value = fn(nums)
  if (value === null || !Number.isFinite(value)) {
    return { ...base, value: null, inputs: list, reason: 'Not meaningful (zero or negative denominator)' }
  }
  return { ...base, value, inputs: list }
}

export const div = (a: number, b: number): number | null => (b === 0 ? null : a / b)

export function growth(curr: number, prev: number): number | null {
  if (prev <= 0) return null
  return (curr - prev) / prev
}

export function quarterNote(basis: 'annual' | 'quarter'): string {
  return basis === 'quarter' ? ' (quarter annualized x4)' : ''
}
