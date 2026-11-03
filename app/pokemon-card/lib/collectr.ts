/**
 * Collectr portfolio export (CSV, emailed from Portfolio → ⋯ → Export) →
 * collection entries. Pure parsing and mapping only; resolving rows to
 * TCGdex cards happens in scripts/import-collectr.ts.
 *
 * Prices, cost paid and watchlist columns are ignored on purpose.
 */
import type { CatalogSnapshot, Condition, TcgCard } from './types.ts'

export type CollectrRow = {
  portfolio: string
  category: string
  set: string
  name: string
  number: string
  printedTotal?: number
  rarity?: string
  variance?: string
  grade?: string
  condition: Condition
  quantity: number
  added?: string
  notes?: string
}

/** Minimal RFC 4180 CSV parser: quoted fields, escaped quotes, CRLF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  const src = text.replace(/^﻿/, '')

  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          quoted = false
        }
      } else {
        field += ch
      }
      continue
    }
    if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i += 1
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += ch
  }
  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((cells) => cells.some((cell) => cell.trim()))
}

const CONDITION_MAP: Record<string, Condition> = {
  'near mint': 'NM',
  nm: 'NM',
  mint: 'NM',
  'lightly played': 'LP',
  lp: 'LP',
  'moderately played': 'MP',
  mp: 'MP',
  'heavily played': 'HP',
  hp: 'HP',
  damaged: 'DMG',
  dmg: 'DMG',
}

export function mapCondition(raw?: string): Condition {
  return CONDITION_MAP[(raw ?? '').trim().toLowerCase()] ?? 'NM'
}

const PRINTING_MAP: Record<string, string> = {
  holofoil: 'holofoil',
  holo: 'holofoil',
  'reverse holofoil': 'reverseHolofoil',
  'reverse holo': 'reverseHolofoil',
  normal: 'normal',
  '1st edition holofoil': '1stEditionHolofoil',
  '1st edition': '1stEditionNormal',
  '1st edition normal': '1stEditionNormal',
  'unlimited holofoil': 'unlimitedHolofoil',
  unlimited: 'unlimited',
}

export function mapPrinting(raw?: string) {
  const key = (raw ?? '').trim().toLowerCase()
  return key ? PRINTING_MAP[key] : undefined
}

/** "129/128" → { number: "129", printedTotal: 128 }; "SWSH050" stays as is. */
export function splitNumber(raw: string) {
  const [number, total] = raw.trim().split('/')
  const printedTotal = total && /^\d+$/.test(total.trim()) ? Number(total) : undefined
  return { number: (number ?? '').trim(), printedTotal }
}

function column(header: string[], ...names: string[]) {
  const lower = header.map((cell) => cell.trim().toLowerCase())
  for (const name of names) {
    const exact = lower.indexOf(name.toLowerCase())
    if (exact !== -1) return exact
  }
  for (const name of names) {
    const prefix = lower.findIndex((cell) => cell.startsWith(name.toLowerCase()))
    if (prefix !== -1) return prefix
  }
  return -1
}

export function parseCollectrCsv(text: string): CollectrRow[] {
  const [header, ...body] = parseCsv(text)
  if (!header) return []
  const at = {
    portfolio: column(header, 'Portfolio Name'),
    category: column(header, 'Category'),
    set: column(header, 'Set'),
    name: column(header, 'Product Name', 'Name'),
    number: column(header, 'Card Number', 'Number'),
    rarity: column(header, 'Rarity'),
    variance: column(header, 'Variance', 'Variant'),
    grade: column(header, 'Grade'),
    condition: column(header, 'Card Condition', 'Condition'),
    quantity: column(header, 'Quantity'),
    added: column(header, 'Date Added'),
    notes: column(header, 'Notes'),
  }
  if (at.set === -1 || at.name === -1 || at.number === -1) {
    throw new Error('Not a Collectr export: expected Set, Product Name and Card Number columns')
  }
  const cell = (cells: string[], index: number) => (index === -1 ? '' : (cells[index] ?? '').trim())

  return body
    .map((cells): CollectrRow => {
      const { number, printedTotal } = splitNumber(cell(cells, at.number))
      const quantity = Number.parseInt(cell(cells, at.quantity) || '1', 10)
      const added = cell(cells, at.added)
      return {
        portfolio: cell(cells, at.portfolio),
        category: cell(cells, at.category),
        set: cell(cells, at.set),
        name: cell(cells, at.name),
        number,
        printedTotal,
        rarity: cell(cells, at.rarity) || undefined,
        variance: cell(cells, at.variance) || undefined,
        grade: cell(cells, at.grade) || undefined,
        condition: mapCondition(cell(cells, at.condition)),
        quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
        added: /^\d{4}-\d{2}-\d{2}/.test(added) ? added.slice(0, 10) : undefined,
        notes: cell(cells, at.notes) || undefined,
      }
    })
    .filter((row) => row.name && row.number && (!row.category || /pok[eé]mon/i.test(row.category)))
}

/** Notes for the stored entry: Collectr notes plus a grade when the card is slabbed. */
export function rowNotes(row: CollectrRow) {
  const parts = [row.notes]
  if (row.grade && !/^ungraded$/i.test(row.grade)) parts.push(`Graded: ${row.grade}`)
  return parts.filter(Boolean).join(' · ') || undefined
}

export function normalizeSetName(name: string) {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, 'and')
    .replace(/^(pokemon|pokémon)\s+/, '')
    .replace(/^(me|sv|swsh|sm|xy)\d*[a-z.]*\s*[:\-–]\s*/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Merge rows for the same set + number + printing so quantities add up. */
export function mergeRows(rows: CollectrRow[]) {
  const map = new Map<string, CollectrRow>()
  for (const row of rows) {
    const key = `${normalizeSetName(row.set)}|${row.number.toLowerCase()}|${mapPrinting(row.variance) ?? ''}`
    const current = map.get(key)
    if (!current) {
      map.set(key, { ...row })
      continue
    }
    current.quantity += row.quantity
    if (row.added && (!current.added || row.added < current.added)) current.added = row.added
    if (row.notes && row.notes !== current.notes) {
      current.notes = [current.notes, row.notes].filter(Boolean).join(' · ')
    }
  }
  return Array.from(map.values())
}

/** Catalog snapshot for a resolved card, without any price fields. */
export function catalogFromCard(card: TcgCard): CatalogSnapshot {
  return {
    name: card.name,
    number: card.number,
    rarity: card.rarity,
    types: card.types,
    setId: card.set?.id,
    setName: card.set?.name,
    printedTotal: card.set?.printedTotal,
    image: card.images?.small,
    imageLarge: card.images?.large,
  }
}
