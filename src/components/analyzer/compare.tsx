import type { Financials } from '@/lib/financials'
import { RATIO_MODULES } from '@/modules/registry'
import { GOOD_DIRECTION } from '@/modules/prior'
import type { ModuleResult } from '@/modules/types'
import { cn } from '@/lib/utils'
import { formatMetric } from './format'
import { Panel } from './ui'

const SKIP = new Set(['industry', 'market', 'valuation'])
const name = (f: Financials) => `${f.meta.ticker ?? f.meta.name} ${f.meta.form} ${f.meta.periodEnd}`

export function ComparePanel({ a, b, ra, rb, onClose }: { a: Financials; b: Financials; ra: Record<string, ModuleResult>; rb: Record<string, ModuleResult>; onClose: () => void }) {
  const rows = RATIO_MODULES.filter((m) => !SKIP.has(m.id)).flatMap((mod) =>
    (ra[mod.id]?.metrics ?? [])
      .map((m) => ({ m, other: rb[mod.id]?.metrics.find((x) => x.id === m.id) }))
      .filter(({ m, other }) => m.value !== null && other?.value != null),
  )
  if (!rows.length) return null
  return (
    <Panel
      title="Compare"
      right={<button type="button" onClick={onClose} className="text-[11px] text-(--accent) hover:underline">Close</button>}
      className="shrink-0"
    >
      <div className="max-h-96 overflow-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-(--line) text-[11px] text-(--muted)">
              <th className="px-3 py-1.5 font-medium">Ratio</th>
              <th className="px-3 py-1.5 text-right font-medium">{name(a)}</th>
              <th className="px-3 py-1.5 text-right font-medium">{name(b)}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ m, other }) => {
              const good = GOOD_DIRECTION[m.id]
              const av = m.value as number
              const bv = other!.value as number
              const win = !good || av === bv ? null : (av > bv) === (good === 'higher') ? 'a' : 'b'
              return (
                <tr key={m.id} className="border-b border-(--line)">
                  <td className="px-3 py-1.5 text-xs font-medium">{m.label}</td>
                  <td className={cn('num px-3 py-1.5 text-right text-xs', win === 'a' && 'font-semibold text-(--up)', win === 'b' && 'text-(--down)')}>{formatMetric(m)}</td>
                  <td className={cn('num px-3 py-1.5 text-right text-xs', win === 'b' && 'font-semibold text-(--up)', win === 'a' && 'text-(--down)')}>{formatMetric(other!)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="px-3 py-2 text-[11px] text-(--muted)">Green is the favorable side of each ratio. Unjudged ratios stay plain.</p>
    </Panel>
  )
}
