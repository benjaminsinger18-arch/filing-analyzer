import { Parser } from 'htmlparser2'

export type Period = { instant?: string; start?: string; end?: string }

export type Fact = {
  name: string
  contextRef: string
  unitRef?: string
  value: number
}

export type ParsedFiling = {
  cover: Record<string, string>
  contexts: Record<string, { period: Period; dimensional: boolean }>
  facts: Fact[]
}

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august',
  'september', 'october', 'november', 'december',
]

/** Turn "September 28, 2024" or "2024-09-28" into "2024-09-28". Returns the input if unrecognized. */
export function toIsoDate(raw: string): string {
  const text = raw.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text
  const m = text.match(/^([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/)
  if (m) {
    const month = MONTHS.indexOf(m[1].toLowerCase())
    if (month >= 0) {
      return `${m[3]}-${String(month + 1).padStart(2, '0')}-${m[2].padStart(2, '0')}`
    }
  }
  return text
}

function parseNumber(text: string, format: string, scale: number, negative: boolean): number | null {
  const fmt = format.toLowerCase()
  let value: number
  if (fmt.includes('zerodash') || fmt.includes('fixed-zero') || fmt.includes('fixedzero')) {
    value = 0
  } else {
    let cleaned = text.replace(/[\s $]/g, '')
    if (fmt.includes('comma-decimal') || fmt.includes('numcommadecimal')) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.')
    } else {
      cleaned = cleaned.replace(/,/g, '')
    }
    if (cleaned === '' || cleaned === '-' || cleaned === '—') {
      value = 0
    } else {
      value = Number(cleaned)
      if (Number.isNaN(value)) return null
    }
  }
  value *= Math.pow(10, scale)
  return negative ? -value : value
}

type Collector = {
  kind: 'num' | 'text'
  attrs: Record<string, string>
  text: string
}

/**
 * Parse an inline-XBRL (iXBRL) filing. Collects numeric facts, dei cover facts and
 * context periods. Works in the browser and in Node.
 */
export function parseIxbrl(html: string): ParsedFiling {
  const cover: Record<string, string> = {}
  const contexts: ParsedFiling['contexts'] = {}
  const facts: Fact[] = []

  const collectors: Collector[] = []
  let ctxId: string | null = null
  let ctxPeriod: Period = {}
  let ctxDimensional = false
  let textTarget: 'instant' | 'start' | 'end' | null = null
  let textBuffer = ''

  const parser = new Parser(
    {
      onopentag(name, attrs) {
        if (name === 'ix:nonfraction') {
          collectors.push({ kind: 'num', attrs, text: '' })
        } else if (name === 'ix:nonnumeric') {
          collectors.push({ kind: 'text', attrs, text: '' })
        } else if (name === 'xbrli:context') {
          ctxId = attrs.id ?? null
          ctxPeriod = {}
          ctxDimensional = false
        } else if (ctxId && (name === 'xbrldi:explicitmember' || name === 'xbrldi:typedmember')) {
          ctxDimensional = true
        } else if (ctxId && name === 'xbrli:instant') {
          textTarget = 'instant'
          textBuffer = ''
        } else if (ctxId && name === 'xbrli:startdate') {
          textTarget = 'start'
          textBuffer = ''
        } else if (ctxId && name === 'xbrli:enddate') {
          textTarget = 'end'
          textBuffer = ''
        }
      },
      ontext(text) {
        if (textTarget) textBuffer += text
        // Nested ix elements (e.g. a date split across two tags) contribute to every open ancestor.
        for (const c of collectors) c.text += text
      },
      onclosetag(name) {
        if (name === 'ix:nonfraction' || name === 'ix:nonnumeric') {
          const c = collectors.pop()
          if (!c) return
          const factName = c.attrs.name
          if (!factName) return
          if (c.kind === 'num') {
            if (c.attrs.xsi_nil === 'true' || c.attrs['xsi:nil'] === 'true') return
            const value = parseNumber(
              c.text,
              c.attrs.format ?? '',
              Number(c.attrs.scale ?? 0) || 0,
              c.attrs.sign === '-',
            )
            if (value !== null && c.attrs.contextref) {
              facts.push({
                name: factName,
                contextRef: c.attrs.contextref,
                unitRef: c.attrs.unitref,
                value,
              })
            }
          } else if (factName.startsWith('dei:') && !(factName in cover)) {
            cover[factName] = c.text.replace(/\s+/g, ' ').trim()
          }
        } else if (name === 'xbrli:instant' || name === 'xbrli:startdate' || name === 'xbrli:enddate') {
          if (textTarget) ctxPeriod[textTarget] = toIsoDate(textBuffer)
          textTarget = null
        } else if (name === 'xbrli:context') {
          if (ctxId) contexts[ctxId] = { period: ctxPeriod, dimensional: ctxDimensional }
          ctxId = null
        }
      },
    },
    { lowerCaseTags: true, lowerCaseAttributeNames: true, decodeEntities: true },
  )
  parser.write(html)
  parser.end()

  return { cover, contexts, facts }
}

export function isIxbrl(parsed: ParsedFiling): boolean {
  return parsed.facts.length > 0 && Object.keys(parsed.contexts).length > 0
}
