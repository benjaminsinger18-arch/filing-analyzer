import { scoreMetric } from '@/modules/rating'
import { GOOD_DIRECTION, INDUSTRY_ROW_FOR } from '@/modules/prior'
import type { Metric, ModuleResult } from '@/modules/types'
import { cn } from '@/lib/utils'
import { formatMetric, scoreTone } from './format'
import { Panel } from './ui'
import { readTone } from './tables'

/** Change vs. one year earlier, as text, or null when there is nothing meaningful to show. */
export function deltaLabel(m: Metric, prior: number | undefined): { text: string; diff: number } | null {
  if (m.value === null || prior === undefined || m.unit === 'usd') return null
  const diff = m.value - prior
  let text: string
  switch (m.unit) {
    case '%': text = `${(diff * 100).toFixed(1)} pts`; break
    case 'x': text = `${diff.toFixed(2)}x`; break
    case 'days': text = `${Math.round(diff)} d`; break
    default: text = diff.toFixed(Number.isInteger(m.value) ? 0 : 2)
  }
  if (Number.parseFloat(text) === 0) return null
  return { text: `${diff > 0 ? '+' : ''}${text}`, diff }
}

export function deltaTone(id: string, diff: number): string {
  const good = GOOD_DIRECTION[id]
  if (!good) return 'text-(--muted)'
  return (diff > 0) === (good === 'higher') ? 'text-(--up)' : 'text-(--down)'
}

export function RatioBook({ rows, prior, industry }: { rows: { m: Metric }[]; prior: Record<string, number>; industry?: ModuleResult }) {
  return (
    <Panel title="Ratio book" className="min-h-60 flex-1">
      <div className="min-h-0 overflow-y-auto">
        <table className="w-full text-left">
          <tbody>
            {rows.map(({ m }) => {
              const s = scoreMetric(m.id, m.value)
              const d = deltaLabel(m, prior[m.id])
              const ind = industry?.metrics.find((x) => x.id === INDUSTRY_ROW_FOR[m.id])?.compare
              const dot = ind && ind.flag !== 'n/a' ? readTone[ind.read] : null
              return (
                <tr key={m.id} className="border-b border-(--line)">
                  <td className="px-3 py-1.5">
                    <span className="text-xs">{m.label}</span>
                    {dot ? <span className={cn('ml-1.5 text-[10px]', dot)} title={`${ind!.read} vs. industry`}>●</span> : null}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <span className={cn('num block text-xs', scoreTone(s))}>{formatMetric(m)}</span>
                    {d ? <span className={cn('num block text-[10px]', deltaTone(m.id, d.diff))} title="Change vs. one year earlier">{d.text}</span> : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}
