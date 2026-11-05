'use client'

import { useState, type ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  AlertTriangle,
  BookOpen,
  ClipboardList,
  FlaskConical,
  LayoutDashboard,
  Scale,
  Sliders,
  Target,
  type LucideIcon,
} from 'lucide-react'
import '../watermelon/bionis-dashboard/dashboard.css'
import {
  assumptions,
  benchmarks,
  fmt,
  gapTests,
  limits,
  notScored,
  ranked,
  scored,
  type Flag,
  type Read,
  type ScoredMetric,
} from './data'
import { cn } from '@/lib/utils'

type View = 'dashboard' | 'benchmarks' | 'assumptions'

const nav: { id: View; name: string; icon: LucideIcon }[] = [
  { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
  { id: 'benchmarks', name: 'Benchmarks', icon: Scale },
  { id: 'assumptions', name: 'Company Assumptions', icon: Sliders },
]

const readColor: Record<Read, string> = {
  Favorable: 'var(--live)',
  Unfavorable: 'var(--insight-vitals)',
  'On par': 'var(--chart-axis)',
}

const flagTone: Record<Flag, string> = {
  Above: 'bg-(--live)/10 text-(--live)',
  At: 'bg-muted text-muted-foreground',
  Below: 'bg-(--insight-vitals)/10 text-(--insight-vitals)',
}

const metricChip: Record<string, string> = {
  trial: 'var(--metric-sleep)',
  nrr: 'var(--metric-recovery)',
  growth: 'var(--metric-steps)',
  cycle: 'var(--metric-warn)',
}

function Chip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex w-fit rounded-xl px-2.5 py-1 text-xs font-medium', className)}>
      {children}
    </span>
  )
}

function Section({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-lg font-medium">{title}</h2>
        {sub ? <p className="text-sm text-muted-foreground">{sub}</p> : null}
      </div>
      {children}
    </section>
  )
}

function MetricCard({ m }: { m: ScoredMetric }) {
  return (
    <article className="flex min-h-37.5 min-w-0 flex-col justify-between rounded-2xl border p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-white"
            style={{ backgroundColor: metricChip[m.id] }}
          >
            <Target className="size-3.5" />
          </span>
          <p className="truncate text-sm font-medium tracking-tight">{m.label}</p>
        </div>
        <Chip className={flagTone[m.flag]}>{m.flag}</Chip>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-3xl leading-none font-semibold tracking-tight">{fmt(m.company, m.unit)}</p>
        <p className="text-xs text-muted-foreground">
          Benchmark {fmt(m.benchmark, m.unit)} · index {m.index.toFixed(2)}
        </p>
        <p className="text-xs font-medium" style={{ color: readColor[m.read] }}>
          {m.read} · gap {fmt(m.gap, m.unit, true)} ({m.gapPct > 0 ? '+' : ''}
          {Math.round(m.gapPct * 100)}%)
        </p>
      </div>
    </article>
  )
}

function IndexChart() {
  const data = scored.map((m) => ({
    name: m.label,
    index: Math.round(m.index * 100),
    company: fmt(m.company, m.unit),
    benchmark: fmt(m.benchmark, m.unit),
    color: readColor[m.read],
  }))
  return (
    <article className="flex min-w-0 flex-col gap-4 rounded-2xl border p-4">
      <div className="flex flex-col gap-1">
        <h3 className="font-medium">Company vs. benchmark</h3>
        <p className="text-xs text-muted-foreground">
          Company as % of benchmark (100% = at benchmark). Dashed band is the ±10% tolerance. Hover for raw values.
        </p>
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: -12 }}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--chart-axis)' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--chart-axis)' }} tickLine={false} axisLine={false} unit="%" />
            <ReferenceLine y={100} stroke="var(--foreground)" />
            <ReferenceLine y={90} stroke="var(--chart-axis)" strokeDasharray="4 4" />
            <ReferenceLine y={110} stroke="var(--chart-axis)" strokeDasharray="4 4" />
            <Tooltip
              cursor={{ fill: 'transparent' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const p = payload[0].payload as (typeof data)[number]
                return (
                  <div className="rounded-lg border bg-(--chart-tooltip-bg) px-3 py-2 text-xs shadow-sm">
                    <p className="font-medium">{p.name}</p>
                    <p>Company {p.company}</p>
                    <p>Benchmark {p.benchmark}</p>
                    <p>Index {p.index}%</p>
                  </div>
                )
              }}
            />
            <Bar dataKey="index" radius={[6, 6, 0, 0]} maxBarSize={56}>
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </article>
  )
}

function Headline() {
  return (
    <article className="flex min-w-0 flex-col gap-4 rounded-2xl border bg-[linear-gradient(180deg,rgb(99_102_241/0.08)_0%,transparent_42%)] p-4">
      <div className="flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-md bg-(--insight-prediction) text-white">
          <AlertTriangle className="size-4" />
        </span>
        <h3 className="font-medium">Largest deviations</h3>
      </div>
      <p className="text-xs text-muted-foreground">Ranked by |gap %|. Only 4 metrics have both a benchmark and a company value.</p>
      <ol className="flex flex-col gap-2">
        {ranked.map((m, i) => (
          <li key={m.id} className="flex items-center gap-3 rounded-xl bg-muted px-3 py-2">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-background text-xs font-semibold">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{m.label}</p>
              <p className="text-xs" style={{ color: readColor[m.read] }}>
                {m.read}
              </p>
            </div>
            <p className="shrink-0 text-sm font-semibold">
              {m.gapPct > 0 ? '+' : ''}
              {Math.round(m.gapPct * 100)}%
            </p>
            <Chip className={flagTone[m.flag]}>{m.flag}</Chip>
          </li>
        ))}
      </ol>
    </article>
  )
}

function ComparisonTable() {
  return (
    <div className="overflow-x-auto rounded-2xl border">
      <table className="w-full min-w-170 text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            {['Metric', 'Unit', 'Company', 'Benchmark', 'Gap', 'Gap %', 'Index', 'Flag (±10%)', 'Read', 'Source'].map((h) => (
              <th key={h} className="px-3 py-2.5 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {scored.map((m) => (
            <tr key={m.id} className="border-b last:border-0">
              <td className="px-3 py-2.5 font-medium">{m.label}</td>
              <td className="px-3 py-2.5 text-muted-foreground">{m.unit === 'pct' ? '%' : 'weeks'}</td>
              <td className="px-3 py-2.5">{fmt(m.company, m.unit)}</td>
              <td className="px-3 py-2.5">{fmt(m.benchmark, m.unit)}</td>
              <td className="px-3 py-2.5">{fmt(m.gap, m.unit, true)}</td>
              <td className="px-3 py-2.5">
                {m.gapPct > 0 ? '+' : ''}
                {Math.round(m.gapPct * 100)}%
              </td>
              <td className="px-3 py-2.5">{m.index.toFixed(2)}</td>
              <td className="px-3 py-2.5">
                <Chip className={flagTone[m.flag]}>{m.flag}</Chip>
              </td>
              <td className="px-3 py-2.5 font-medium" style={{ color: readColor[m.read] }}>
                {m.read}
              </td>
              <td className="px-3 py-2.5 text-xs text-muted-foreground">{m.source}</td>
            </tr>
          ))}
          {notScored.map((n) => (
            <tr key={n.label} className="border-b text-muted-foreground last:border-0">
              <td className="px-3 py-2.5">{n.label}</td>
              <td colSpan={7} className="px-3 py-2.5 text-xs">
                Not scored: {n.why}
              </td>
              <td className="px-3 py-2.5">-</td>
              <td className="px-3 py-2.5">-</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DashboardView() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-medium md:text-2xl">GTM Benchmark Dashboard</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          A hypothetical $20M ARR seat-based B2B SaaS company compared with 2026 GTM benchmarks. Company figures are
          illustrative assumptions; ICONIQ values come from a secondary summary and are unverified.
        </p>
        <div className="flex flex-wrap gap-2">
          <Chip className="bg-(--chart-warn-bg) text-(--chart-warn)">Illustrative data</Chip>
          <Chip className="bg-muted text-muted-foreground">Flag: Above / Below outside ±10% of benchmark</Chip>
        </div>
      </div>

      <Section title="Key metrics" sub="Company assumption vs matching benchmark">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {scored.map((m) => (
            <MetricCard key={m.id} m={m} />
          ))}
        </div>
      </Section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.5fr_1fr]">
        <IndexChart />
        <Headline />
      </section>

      <Section title="Comparison detail" sub="Gap = company - benchmark. Index = company / benchmark.">
        <ComparisonTable />
      </Section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article className="flex flex-col gap-4 rounded-2xl border bg-[linear-gradient(180deg,rgb(20_184_166/0.08)_0%,transparent_42%)] p-4">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-md bg-(--insight-actions) text-white">
              <FlaskConical className="size-4" />
            </span>
            <h3 className="font-medium">First test per gap</h3>
          </div>
          <div className="flex flex-col gap-2">
            {gapTests.map((g) => (
              <div key={g.title} className="flex flex-col gap-1.5 rounded-xl bg-muted px-3 py-2.5">
                <p className="text-sm font-medium">
                  {g.title} <span className="font-normal text-muted-foreground">· {g.gap}</span>
                </p>
                <p className="text-xs text-muted-foreground">{g.cause}</p>
                <p className="text-xs">
                  <span className="font-medium">Test:</span> {g.test}
                </p>
                <p className="text-xs">
                  <span className="font-medium">Success:</span> {g.success}
                </p>
              </div>
            ))}
          </div>
        </article>

        <article className="flex flex-col gap-4 rounded-2xl border bg-[linear-gradient(180deg,rgb(247_46_46/0.08)_0%,transparent_42%)] p-4">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-md bg-(--insight-vitals) text-white">
              <ClipboardList className="size-4" />
            </span>
            <h3 className="font-medium">What the benchmarks cannot tell us</h3>
          </div>
          <ul className="flex flex-col gap-2">
            {limits.map((l) => (
              <li key={l} className="rounded-xl bg-muted px-3 py-2.5 text-xs text-muted-foreground">
                {l}
              </li>
            ))}
          </ul>
        </article>
      </section>
    </div>
  )
}

const statusTone: Record<string, string> = {
  Unverified: 'bg-(--chart-warn-bg) text-(--chart-warn)',
  'Re-confirm': 'bg-muted text-muted-foreground',
  'No source': 'bg-(--insight-vitals)/10 text-(--insight-vitals)',
}

function BenchmarksView() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-medium md:text-2xl">Benchmarks</h1>
        <p className="text-sm text-muted-foreground">
          Blank values are marked no source; nothing is estimated. Percent values are shares; cycle is in weeks.
        </p>
      </div>
      <div className="overflow-x-auto rounded-2xl border">
        <table className="w-full min-w-225 text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              {['Metric', 'Value', 'Year', 'Source', 'Sample size', 'Status', 'Link', 'Notes'].map((h) => (
                <th key={h} className="px-3 py-2.5 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {benchmarks.map((b) => (
              <tr key={b.id} className="border-b align-top last:border-0">
                <td className="px-3 py-2.5 font-medium">{b.metric}</td>
                <td className="px-3 py-2.5">{b.value === null ? '-' : fmt(b.value, b.unit)}</td>
                <td className="px-3 py-2.5">{b.year}</td>
                <td className="px-3 py-2.5 text-xs">{b.source}</td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground">{b.sample}</td>
                <td className="px-3 py-2.5">
                  <Chip className={statusTone[b.status]}>{b.status}</Chip>
                </td>
                <td className="px-3 py-2.5 text-xs">
                  {b.link ? (
                    <a className="underline" href={b.link} target="_blank" rel="noreferrer">
                      Open
                    </a>
                  ) : (
                    '-'
                  )}
                </td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground">{b.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AssumptionsView() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-medium md:text-2xl">Company Assumptions</h1>
        <Chip className="bg-(--chart-warn-bg) text-(--chart-warn)">
          Hypothetical company: every value is an illustrative assumption
        </Chip>
      </div>
      <div className="overflow-x-auto rounded-2xl border">
        <table className="w-full min-w-120 text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              {['Metric', 'Value', 'Label', 'Benchmark used'].map((h) => (
                <th key={h} className="px-3 py-2.5 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {assumptions.map((a) => (
              <tr key={a.metric} className="border-b last:border-0">
                <td className="px-3 py-2.5 font-medium">{a.metric}</td>
                <td className="px-3 py-2.5">{a.display}</td>
                <td className="px-3 py-2.5">
                  <Chip className="bg-muted text-muted-foreground">Assumption</Chip>
                </td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground">{a.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function GtmDashboard() {
  const [view, setView] = useState<View>('dashboard')
  return (
    <div className="bionis-dashboard flex h-svh overflow-hidden">
      <aside className="hidden w-64 shrink-0 flex-col gap-6 border-r bg-(--sidebar) p-4 md:flex">
        <div className="flex items-center gap-2 px-2 pt-1">
          <span className="flex size-7 items-center justify-center rounded-md bg-(--bionis-blue) text-white">
            <BookOpen className="size-4" />
          </span>
          <span className="text-lg font-medium tracking-tight">GTM Bench</span>
        </div>
        <nav className="flex flex-col gap-1">
          {nav.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => setView(n.id)}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm',
                view === n.id ? 'bg-background font-medium shadow-[0_1px_2px_rgba(0,0,0,0.06)]' : 'text-muted-foreground hover:bg-background/60',
              )}
            >
              <n.icon className="size-4" />
              {n.name}
            </button>
          ))}
        </nav>
        <p className="mt-auto rounded-xl border bg-background p-3 text-xs text-muted-foreground">
          Portfolio project. All company figures are placeholders; ICONIQ values are unverified secondary-summary figures.
        </p>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex gap-1 overflow-x-auto border-b px-4 py-2 md:hidden">
          {nav.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => setView(n.id)}
              className={cn('shrink-0 rounded-lg px-3 py-1.5 text-sm', view === n.id ? 'bg-muted font-medium' : 'text-muted-foreground')}
            >
              {n.name}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-10">
          {view === 'dashboard' ? <DashboardView /> : view === 'benchmarks' ? <BenchmarksView /> : <AssumptionsView />}
        </div>
      </main>
    </div>
  )
}
