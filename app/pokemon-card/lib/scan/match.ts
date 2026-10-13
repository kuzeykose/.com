import { availablePrintings } from '../prices'
import {
  canonicalNumber,
  clearTcgdexCache,
  fetchSetCard,
  fetchTcgdexPromo,
  listSetRows,
  padLocalId,
  searchTcgdexCards,
  type SetRow,
} from '../tcgdex'
import type { TcgCard } from '../types'
import {
  distinctiveMatch,
  fuzzyNames,
  matchSignals,
  nameSim,
  parseRawText,
  readsFromQuery,
  scoreMatch,
  splitPromo,
} from './parse'
import type { Match, ScanQuery, ScanResult } from './types'

export const BEST_THRESHOLD = 0.9
export { buildQueries, scoreMatch } from './parse'

export function clearScanCache() {
  clearTcgdexCache()
}

function quotesOf(card: TcgCard) {
  const priced = availablePrintings(card)
  const quotes: Record<string, number> = {}
  for (const key of priced) {
    const market = card.tcgplayer?.prices?.[key]?.market
    if (market != null) quotes[key] = market
  }
  let quoteUnit: 'USD' | 'EUR' | undefined
  if (Object.keys(quotes).length) quoteUnit = 'USD'
  else if (card.cardmarket?.avg != null) {
    quotes.cardmarket = card.cardmarket.avg
    quoteUnit = 'EUR'
  }
  const printings = priced.length ? priced : Object.keys(quotes).length ? Object.keys(quotes) : ['holofoil']
  return {
    quotes,
    printings,
    quoteUnit,
    updatedAt: card.tcgplayer?.updatedAt ?? card.cardmarket?.updatedAt ?? null,
  }
}

export function toMatch(card: TcgCard, score: number): Match {
  const priced = quotesOf(card)
  return {
    id: card.id,
    name: card.name,
    number: card.number,
    set: card.set?.name ?? '',
    setId: card.set?.id ?? '',
    printedTotal: card.set?.printedTotal ?? 0,
    rarity: card.rarity,
    image: card.images?.small,
    imageLarge: card.images?.large,
    score,
    types: card.types,
    printings: priced.printings,
    quotes: priced.quotes,
    quoteUnit: priced.quoteUnit,
    updatedAt: priced.updatedAt,
    source: 'tcgdex',
  }
}

function scoreCard(card: TcgCard) {
  return {
    ...card,
    printedTotal: card.set?.printedTotal,
    setId: card.set?.id,
    hp: card.hp,
    attacks: card.attacks,
    abilities: card.abilities,
  }
}

export function rankCards(cards: TcgCard[], query: ScanQuery): Match[] {
  return cards
    .map((card) => toMatch(card, scoreMatch(scoreCard(card), query)))
    .sort((a, b) => b.score - a.score)
}

/** Sanitize client-sent raw OCR lines (text only). */
export function cleanRawText(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((s): s is string => typeof s === 'string').map((s) => s.slice(0, 200)).slice(0, 24)
}

async function cardsForRead(
  number: string,
  total: string | undefined,
  name: string | undefined,
  sets: SetRow[]
) {
  const found: TcgCard[] = []
  const seen = new Set<string>()
  const push = (card: TcgCard | null | undefined) => {
    if (card?.id && !seen.has(card.id)) {
      seen.add(card.id)
      found.push(card)
    }
  }
  if (total) {
    const matching = sets.filter((row) => String(row.printedTotal) === total)
    const rows = await Promise.all(matching.slice(0, 8).map((row) => fetchSetCard(row.id, number)))
    for (const card of rows) push(card)
  }
  if (!found.length && name) {
    for (const local of Array.from(new Set([padLocalId(number), canonicalNumber(number)]))) {
      const rows = await searchTcgdexCards({ name, localId: local }, 20)
      for (const card of rows) push(card)
      if (found.length) break
    }
  }
  return found
}

/**
 * Match parsed OCR text to printings (TCGdex only). Fallback ladder:
 *  promo      lock to the Black Star set (MEP 072) before any other search
 *  exact      set+localId for sets whose official count matches OCR total
 *  raw-text   re-parse rawText for numbers/names the client vote missed
 *  set-total  sets whose printedTotal == total -> that localId, ranked
 *  fuzzy-name name search, Levenshtein-ranked
 *  number-only localId search
 * candidates is empty only if OCR produced no usable text at all.
 */
export async function matchScan(query: ScanQuery): Promise<ScanResult> {
  const seen = new Map<string, TcgCard>()
  let used: string | undefined
  let stage = 'none'
  const add = (rows: TcgCard[], q: string, s: string) => {
    for (const card of rows) if (card?.id && !seen.has(card.id)) seen.set(card.id, card)
    if (rows.length && !used) {
      used = q
      stage = s
    }
  }

  const promo = splitPromo(query.number || '', query.setCode)
  const promoLock = Boolean(query.kind === 'promo' || query.setCode || promo.setId)

  const sets = await listSetRows()
  const totals = new Set(sets.map((row) => row.printedTotal).filter((n) => n > 0))
  const raw = parseRawText(query.rawText ?? [], totals.size ? totals : undefined)

  if (promoLock && promo.setId) {
    const card = await fetchTcgdexPromo(promo.setId, promo.n)
    if (card) add([card], `set=${promo.setId}&localId=${padLocalId(promo.n)}`, 'exact')
  }

  const nameTokens = Array.from(
    new Set([query.name, ...raw.names].filter((n): n is string => Boolean(n && n.length >= 3)))
  )
  let effective: ScanQuery = query

  if (!promoLock) {
    for (const read of readsFromQuery(query)) {
      const rows = await cardsForRead(read.number, read.total, query.name, sets)
      add(rows, `localId=${read.number}${read.total ? `&printedTotal=${read.total}` : ''}`, 'exact')
      if (seen.size) break
    }
  }

  if ((!seen.size || !query.number) && raw.reads.length && raw.reads[0].number !== query.number) {
    const r = raw.reads[0]
    effective = {
      ...query,
      number: r.number,
      total: r.total,
      kind: r.kind,
      setCode: r.setCode || query.setCode,
      alts: raw.reads.slice(1, 3),
    }
    if (effective.kind === 'promo' && effective.setCode) {
      const locked = splitPromo(effective.number || '', effective.setCode)
      if (locked.setId) {
        const card = await fetchTcgdexPromo(locked.setId, locked.n)
        if (card) add([card], `set=${locked.setId}&localId=${padLocalId(locked.n)}`, 'raw-text')
      }
    } else {
      const rows = await cardsForRead(r.number, r.total, query.name || nameTokens[0], sets)
      add(rows, `raw-text:${r.number}/${r.total ?? ''}`, 'raw-text')
    }
  }

  const total = effective.total ?? raw.reads.find((r) => r.total)?.total
  if (!seen.size && total && !promoLock) {
    const matching = sets.filter((row) => String(row.printedTotal) === total)
    const number = effective.number
    for (const set of matching.slice(0, 3)) {
      const card = number ? await fetchSetCard(set.id, number) : null
      if (card) add([card], `set=${set.id}`, 'set-total')
    }
  }

  const weak =
    seen.size > 0 &&
    !Array.from(seen.values()).some(
      (c) =>
        (effective.number &&
          (/^\d+$/.test(c.number) && /^\d+$/.test(effective.number)
            ? Number(c.number) === Number(effective.number)
            : c.number === effective.number)) ||
        nameTokens.some((n) => nameSim(n, c.name) >= 0.75)
    )
  if (weak) {
    seen.clear()
    used = undefined
    stage = 'none'
  }

  if (promoLock && promo.setId) {
    const locked = Array.from(seen.values()).filter((c) => c.set?.id?.toLowerCase() === promo.setId)
    seen.clear()
    if (locked.length) {
      for (const card of locked) seen.set(card.id, card)
    } else {
      used = undefined
      stage = 'none'
      const fallback = await fetchTcgdexPromo(promo.setId, promo.n)
      if (fallback) add([fallback], `set=${promo.setId}&localId=${padLocalId(promo.n)}`, 'exact')
    }
  }

  if (!seen.size && nameTokens.length && !promoLock) {
    const pool = new Map<string, TcgCard>()
    for (const token of nameTokens.slice(0, 3)) {
      for (const c of await searchTcgdexCards({ name: token }, 20)) pool.set(c.id, c)
      if (pool.size) break
    }
    const names = new Set(Array.from(pool.values()).map((c) => c.name))
    const good = new Set(nameTokens.flatMap((t) => fuzzyNames(t, names, 3, 0.5).map((x) => x.name)))
    const sim = (c: TcgCard) => Math.max(0, ...nameTokens.map((n) => nameSim(n, c.name)))
    const picked = good.size
      ? Array.from(pool.values()).filter((c) => good.has(c.name))
      : Array.from(pool.values()).sort((a, b) => sim(b) - sim(a)).slice(0, 8)
    add(picked, 'fuzzy-name', 'fuzzy-name')
  }

  if (!seen.size && !promoLock) {
    const nums = [effective.number, ...raw.loose].filter((n): n is string => Boolean(n))
    for (const n of nums.slice(0, 3)) {
      let rows = await searchTcgdexCards({ localId: padLocalId(n) }, 20)
      if (!rows.length) rows = await searchTcgdexCards({ localId: canonicalNumber(n) }, 20)
      add(rows, `localId=${n}`, 'number-only')
      if (seen.size) break
    }
  }

  const pool = Array.from(seen.values())
  const scored = rankCards(pool, effective)
  const top = scored[0]
  const gap = top ? top.score - (scored[1]?.score ?? 0) : 0
  let confidence = top ? Number(Math.min(1, top.score - (gap < 0.1 ? 0.15 : 0)).toFixed(2)) : 0
  if (stage !== 'exact' && stage !== 'raw-text') confidence = Math.min(confidence, 0.6)

  const distinctiveTop = top
    ? pool.find((card) => card.id === top.id && distinctiveMatch(scoreCard(card), effective))
    : undefined
  const distinctiveCount = pool.filter((card) => distinctiveMatch(scoreCard(card), effective)).length
  if (distinctiveTop && distinctiveCount === 1) {
    confidence = Math.max(confidence, 0.92)
  } else if (top) {
    const s = matchSignals(scoreCard(pool.find((card) => card.id === top.id) ?? pool[0]), effective)
    const uniquePrint = pool.filter((card) => {
      const row = matchSignals(scoreCard(card), effective)
      return row.numberOk && (row.totalOk || row.setOk)
    })
    if (
      s.numberOk &&
      (s.totalOk || s.setOk) &&
      uniquePrint.length === 1 &&
      uniquePrint[0].id === top.id &&
      (s.agreement >= 0.5 || s.hpOk || s.moveOk || s.similarity >= 0.6)
    ) {
      confidence = Math.max(confidence, 0.92)
    }
  }

  return {
    best: confidence >= BEST_THRESHOLD ? top : null,
    candidates: scored.slice(0, 8),
    confidence,
    ocr: { name: query.name, number: effective.number, total: effective.total },
    query: used,
    stage,
  }
}
