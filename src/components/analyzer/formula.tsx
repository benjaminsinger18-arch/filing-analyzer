'use client'

import katex from 'katex'
import 'katex/dist/katex.min.css'
import { hasMath, splitFormula, TEX_OVERRIDES, toTex } from '@/lib/tex'

function render(tex: string): string {
  return katex.renderToString(tex, { throwOnError: false, displayMode: false, output: 'html' })
}

/** Renders a ratio formula as a typeset equation; falls back to plain text for prose. */
export function Formula({ formula, id }: { formula: string; id?: string }) {
  const override = id ? TEX_OVERRIDES[id] : undefined
  if (override) {
    return <span className="formula" dangerouslySetInnerHTML={{ __html: render(override) }} />
  }
  const { math, note } = splitFormula(formula)
  if (!hasMath(math)) return <span>{formula}</span>
  let html: string
  try {
    html = render(toTex(math))
  } catch {
    return <span>{formula}</span>
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2">
      <span className="formula" dangerouslySetInnerHTML={{ __html: html }} />
      {note ? <span className="text-[10px] text-(--muted)">{note}</span> : null}
    </span>
  )
}
