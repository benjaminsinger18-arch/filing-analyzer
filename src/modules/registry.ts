import { cashflow } from './cashflow'
import { efficiency } from './efficiency'
import { growthModule } from './growth'
import { industry } from './industry'
import { leverage } from './leverage'
import { liquidity } from './liquidity'
import { market } from './market'
import { notes } from './notes'
import { profitability } from './profitability'
import { rating } from './rating'
import { scores } from './scores'
import { valuation } from './valuation'
import type { AnalysisModule, ModuleResult } from './types'
import type { Financials } from '@/lib/financials'

/**
 * Ratio modules run first. Summary modules (rating, notes) run last and read the earlier results.
 * Adding a module = one file implementing AnalysisModule + one line here.
 */
export const RATIO_MODULES: AnalysisModule[] = [
  profitability,
  liquidity,
  leverage,
  efficiency,
  growthModule,
  cashflow,
  scores,
  valuation,
  industry,
  market,
]
export const SUMMARY_MODULES: AnalysisModule[] = [rating, notes]
export const ALL_MODULES = [...RATIO_MODULES, ...SUMMARY_MODULES]

export function runModules(fin: Financials, enabled?: Set<string>): Record<string, ModuleResult> {
  const results: Record<string, ModuleResult> = {}
  for (const mod of RATIO_MODULES) {
    if (enabled && !enabled.has(mod.id)) continue
    results[mod.id] = mod.run(fin, results)
  }
  for (const mod of SUMMARY_MODULES) {
    results[mod.id] = mod.run(fin, results)
  }
  return results
}
