import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Panel({ title, right, children, className }: { title: string; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('flex min-h-0 flex-col rounded-md border border-(--line) bg-(--panel)', className)}>
      <header className="flex items-center justify-between gap-2 border-b border-(--line) px-3 py-2">
        <h3 className="text-xs font-semibold tracking-wide text-(--accent) uppercase">{title}</h3>
        {right}
      </header>
      {children}
    </section>
  )
}

export function Chip({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('inline-flex w-fit rounded px-2 py-0.5 text-[11px] font-medium', className)}>{children}</span>
}

export function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('rounded px-2.5 py-1 text-xs', active ? 'bg-(--panel-2) font-semibold text-(--accent)' : 'text-(--muted) hover:text-(--fg)')}
    >
      {children}
    </button>
  )
}
