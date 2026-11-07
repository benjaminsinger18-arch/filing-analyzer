import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { LINE_ITEM_LABELS, type Financials, type Items, type LineItem } from '@/lib/financials'
import { cn } from '@/lib/utils'
import { compactUsd } from './format'

export type ChartTab = 'income' | 'balance' | 'cash'

/** Which direction of change is good for each chart item; 'none' items are not judged. */
const GOOD_WHEN: Partial<Record<LineItem, 'down' | 'none'>> = { liabilities: 'down', debt: 'down', capex: 'none', da: 'none' }

function changeColor(item: LineItem, cur: number, prior: number): string {
  const good = GOOD_WHEN[item]
  if (good === 'none' || cur === prior) return 'var(--accent)'
  return (cur > prior) === (good !== 'down') ? 'var(--up)' : 'var(--down)'
}

export const CHART_ITEMS: Record<ChartTab, { label: string; items: LineItem[] }> = {
  income: { label: 'Income', items: ['revenue', 'grossProfit', 'operatingIncome', 'netIncome'] },
  balance: { label: 'Balance sheet', items: ['assets', 'liabilities', 'equity', 'cash', 'debt'] },
  cash: { label: 'Cash flow', items: ['ocf', 'capex', 'da'] },
}

function chartSources(fin: Financials, tab: ChartTab): { cur: Items; prior: Items; curLabel: string; priorLabel: string } {
  if (tab === 'balance') return { cur: fin.bsCur, prior: fin.bsPrior, curLabel: fin.meta.periodEnd, priorLabel: 'prior year-end' }
  if (tab === 'cash') return { cur: fin.ytd, prior: fin.ytdPrior, curLabel: fin.basis === 'quarter' ? 'YTD' : 'FY', priorLabel: 'prior YTD' }
  return { cur: fin.cur, prior: fin.prior, curLabel: fin.basis === 'quarter' ? 'quarter' : 'FY', priorLabel: fin.basis === 'quarter' ? 'prior-yr quarter' : 'prior FY' }
}

export function FundamentalsChart({ fin, tab }: { fin: Financials; tab: ChartTab }) {
  const src = chartSources(fin, tab)
  const rows = CHART_ITEMS[tab].items
    .filter((i) => src.cur[i] || src.prior[i])
    .map((i) => ({
      item: i,
      name: LINE_ITEM_LABELS[i],
      cur: src.cur[i]?.value ?? 0,
      prior: src.prior[i]?.value ?? 0,
      has: !!src.cur[i],
      hasPrior: !!src.prior[i],
    }))
  if (!rows.length) return null
  return (
    <div className="min-h-72 flex-1 px-2 pb-2">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 12, right: 12, bottom: 0, left: 4 }} barGap={3}>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted)' }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} tickLine={false} axisLine={false} tickFormatter={(v) => compactUsd(v).replace('.00', '')} width={64} />
          <Tooltip
            cursor={{ fill: 'var(--panel-2)' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const p = payload[0].payload as (typeof rows)[number]
              const chg = p.hasPrior && p.prior !== 0 ? (p.cur - p.prior) / Math.abs(p.prior) : null
              return (
                <div className="rounded border border-(--line) bg-(--panel) px-3 py-2 text-xs text-(--fg) shadow-lg">
                  <p className="font-semibold">{p.name}</p>
                  {p.has ? <p className="num">{src.curLabel}: {compactUsd(p.cur)}</p> : null}
                  {p.hasPrior ? <p className="num text-(--muted)">{src.priorLabel}: {compactUsd(p.prior)}</p> : null}
                  {chg !== null ? <p className="num" style={{ color: changeColor(p.item, p.cur, p.prior) }}>{chg >= 0 ? '+' : ''}{(chg * 100).toFixed(1)}%</p> : null}
                </div>
              )
            }}
          />
          <Bar dataKey="prior" fill="var(--line)" radius={[3, 3, 0, 0]} maxBarSize={36} />
          <Bar dataKey="cur" radius={[3, 3, 0, 0]} maxBarSize={36}>
            {rows.map((r) => (
              <Cell key={r.name} fill={changeColor(r.item, r.cur, r.prior)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function StatStrip({ fin }: { fin: Financials }) {
  const src = chartSources(fin, 'income')
  const items = (['revenue', 'operatingIncome', 'netIncome', 'epsDiluted'] as LineItem[]).filter((i) => src.cur[i])
  if (!items.length) return null
  return (
    <div className="flex flex-wrap gap-px bg-(--line)">
      {items.map((i) => {
        const cur = src.cur[i]!.value
        const prior = src.prior[i]?.value
        const chg = prior !== undefined && prior > 0 ? (cur - prior) / prior : null
        return (
          <div key={i} className="min-w-40 flex-1 bg-(--panel) px-3 py-2">
            <p className="text-[11px] text-(--muted)">{LINE_ITEM_LABELS[i]}</p>
            <p className="num text-base font-semibold">{i === 'epsDiluted' ? `$${cur.toFixed(2)}` : compactUsd(cur)}</p>
            {chg !== null ? <p className={cn('num text-xs', chg >= 0 ? 'text-(--up)' : 'text-(--down)')}>{chg >= 0 ? '+' : ''}{(chg * 100).toFixed(1)}%</p> : null}
          </div>
        )
      })}
    </div>
  )
}
