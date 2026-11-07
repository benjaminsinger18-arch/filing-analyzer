/**
 * Turns the plain-text formulas used by the ratio modules ("Gross profit / Revenue",
 * "(Net income - OCF) / Total assets (quarter annualized x4)") into LaTeX for KaTeX.
 * Words become \text{...}; "/" becomes a fraction; "x" becomes \times.
 */

const ESCAPES: Record<string, string> = {
  '&': '\\&',
  '%': '\\%',
  '#': '\\#',
  $: '\\$',
  _: '\\_',
  '{': '\\{',
  '}': '\\}',
  '\\': '\\textbackslash{}',
  '^': '\\^{}',
  '~': '\\~{}',
}

const escapeText = (s: string) => s.replace(/[&%#$_{}\\^~]/g, (c) => ESCAPES[c])

/** Hand-written equations for formulas the text converter cannot express. */
export const TEX_OVERRIDES: Record<string, string> = {
  altman:
    "Z'' = 6.56\\,\\dfrac{WC}{TA} + 3.26\\,\\dfrac{RE}{TA} + 6.72\\,\\dfrac{EBIT}{TA} + 1.05\\,\\dfrac{BVE}{TL}",
}

export function splitFormula(formula: string): { math: string; note?: string } {
  let math = formula.trim()
  let note: string | undefined
  const trailing = math.match(/\s*\((?:quarter[^)]*|year-to-date|[^)]*x4)\)\s*$/)
  if (trailing && trailing.index !== undefined) {
    note = trailing[0].trim().replace(/^\(|\)$/g, '').replace(/ x4/g, ' ×4')
    math = math.slice(0, trailing.index).trim()
  }
  // A trailing parenthetical with no operators is an annotation, e.g. "(DuPont leverage term)".
  const aside = math.match(/\s\(([^()/+]*)\)$/)
  if (aside && aside.index !== undefined && /\s[/+x-]\s/.test(math.slice(0, aside.index))) {
    note = [aside[1].trim(), note].filter(Boolean).join('; ')
    math = math.slice(0, aside.index).trim()
  }
  let depth = 0
  for (let i = 0; i < math.length; i++) {
    const ch = math[i]
    if (ch === '(') depth++
    else if (ch === ')') depth--
    else if (ch === ',' && depth === 0) {
      note = [math.slice(i + 1).trim(), note].filter(Boolean).join('; ')
      math = math.slice(0, i).trim()
      break
    }
  }
  return { math, note }
}

/** True when the string contains an arithmetic operator worth typesetting. */
export const hasMath = (math: string) => /\s[/+x-]\s/.test(math)

type Node = { tex: string; inner?: string }

export function toTex(math: string): string {
  const tokens = math
    .split(/(\s\/\s|\s-\s|\s\+\s|\sx\s|[()])/)
    .map((t) => t.trim())
    .filter((t) => t !== '')
  let pos = 0
  const peek = () => tokens[pos]
  const inner = (n: Node) => n.inner ?? n.tex

  function factor(): Node {
    const t = tokens[pos++]
    if (t === undefined) throw new Error('unexpected end')
    if (t === '(') {
      const e = expr()
      if (tokens[pos++] !== ')') throw new Error('missing )')
      return { tex: `\\left(${e.tex}\\right)`, inner: e.tex }
    }
    if (['/', '-', '+', 'x', ')'].includes(t)) throw new Error(`unexpected ${t}`)
    return { tex: `\\text{${escapeText(t)}}` }
  }

  function term(): Node {
    let left = factor()
    while (peek() === '/' || peek() === 'x') {
      const op = tokens[pos++]
      const right = factor()
      left = op === '/' ? { tex: `\\dfrac{${inner(left)}}{${inner(right)}}` } : { tex: `${left.tex} \\times ${right.tex}` }
    }
    return left
  }

  function expr(): Node {
    let left = term()
    while (peek() === '+' || peek() === '-') {
      const op = tokens[pos++]
      const right = term()
      left = { tex: `${left.tex} ${op === '-' ? '-' : '+'} ${right.tex}` }
    }
    return left
  }

  const result = expr()
  if (pos !== tokens.length) throw new Error('trailing tokens')
  return result.tex
}
