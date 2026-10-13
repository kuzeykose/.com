import { TCG_API } from '../constants'
import { availablePrintings } from '../prices'
import { tcgApiHeaders, tcgApiKey } from '../tcg-key'
import type { TcgCard } from '../types'
import { buildQueries, fuzzyNames, nameSim, parseRawText, readsFromQuery, scoreMatch, splitPromo } from './parse'
import type { Match, RecognizeOptions, ScanQuery, ScanResult } from './types'

export const BEST_THRESHOLD = 0.9
export { buildQueries, scoreMatch } from './parse'

const CACHE_TTL = 24 * 3600 * 1000
const queryCache = new Map<string, { t: number; data: unknown }>()
const SELECT = 'id,name,number,hp,attacks,abilities,set,images,rarity,types,tcgplayer'

export function clearScanCache() {
  queryCache.clear()
}

async function getJson<T>(path: string, apiKey?: string): Promise<T | null> {
  const hit = queryCache.get(path)
  if (hit && Date.now() - hit.t < CACHE_TTL) return hit.data as T
  const headers = apiKey ? { ...tcgApiHeaders(), 'X-Api-Key': apiKey } : tcgApiHeaders()
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`${TCG_API}${path}`, { headers }).catch(() => null)
    if (res?.ok) {
      const data = (await res.json()) as T
      queryCache.set(path, { t: Date.now(), data })
      return data
    }
    if (!res || res.status === 429 || res.status >= 500) {
      await new Promise((resolve) => setTimeout(resolve, 400 * 2 ** attempt))
      continue
    }
    return null
  }
  return null
}

async function queryCards(q: string, apiKey?: string, pageSize = 50): Promise<TcgCard[]> {
  const body = await getJson<{ data?: TcgCard[] }>(`/cards?q=${encodeURIComponent(q)}&pageSize=${pageSize}&select=${SELECT}`, apiKey)
  return body?.data ?? []
}

type SetRow = { id: string; name: string; printedTotal: number; total: number }
async function allSets(apiKey?: string): Promise<SetRow[]> {
  const body = await getJson<{ data?: SetRow[] }>(`/sets?pageSize=250&select=id,name,printedTotal,total`, apiKey)
  return body?.data ?? []
}

export function toMatch(card: TcgCard, score: number): Match {
  const printings = availablePrintings(card)
  const quotes: Record<string, number> = {}
  for (const key of printings) {
    const market = card.tcgplayer?.prices?.[key]?.market
    if (market != null) quotes[key] = market
  }
  return {
    id: card.id,
    name: card.name,
    number: card.number,
    set: card.set?.name ?? '',
    setId: card.set?.id ?? '',
    printedTotal: card.set?.printedTotal ?? 0,
    rarity: card.rarity,
    image: card.images?.small,
    score,
    types: card.types,
    printings,
    quotes,
    updatedAt: card.tcgplayer?.updatedAt ?? null,
  }
}

export function rankCards(cards: TcgCard[], query: ScanQuery): Match[] {
  return cards
    .map((card) =>
      toMatch(
        card,
        scoreMatch(
          {
            ...card,
            printedTotal: card.set?.printedTotal,
            setId: card.set?.id,
            hp: card.hp,
            attacks: card.attacks,
            abilities: card.abilities,
          },
          query
        )
      )
    )
    .sort((a, b) => b.score - a.score)
}

/** Sanitize client-sent raw OCR lines (text only). */
export function cleanRawText(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((s): s is string => typeof s === 'string').map((s) => s.slice(0, 200)).slice(0, 24)
}

/**
 * Match parsed OCR text to printings. Fallback ladder (stops at first stage with candidates):
 *  exact      buildQueries (number+total+name ... name)
 *  raw-text   re-parse rawText for numbers/names the client vote missed, rerun exact
 *  set-total  sets whose printedTotal == total -> all cards in those sets, ranked by fuzzy name / number
 *  fuzzy-name 4-char substrings of every name token as wildcards, Levenshtein-ranked
 *  number-only number:<n> (and loose 2-3 digit groups from raw text)
 * candidates is empty only if OCR produced no usable text at all.
 */
export async function matchScan(query: ScanQuery, opts: RecognizeOptions = {}): Promise<ScanResult> {
  const apiKey = opts.apiKey || tcgApiKey() || undefined
  const seen = new Map<string, TcgCard>()
  let used: string | undefined
  let stage = 'none'
  const add = (rows: TcgCard[], q: string, s: string) => {
    for (const card of rows) if (!seen.has(card.id)) seen.set(card.id, card)
    if (rows.length && !used) { used = q; stage = s }
  }
  const runTries = async (q: ScanQuery, s: string) => {
    const pick = readsFromQuery(q)[0]
    for (const t of buildQueries(q)) {
      add(await queryCards(t, apiKey), t, s)
      if (seen.size && seen.size <= 5 && pick) break
    }
  }

  const promo = splitPromo(query.number || '', query.setCode)
  const promoLock = Boolean(query.kind === 'promo' || query.setCode || promo.setId)

  const sets = query.rawText?.length || !query.number || promoLock ? await allSets(apiKey) : []
  const raw = parseRawText(query.rawText ?? [], sets.length ? new Set(sets.map((s) => s.printedTotal)) : undefined)

  await runTries(query, 'exact')

  if (promoLock && promo.setId) {
    const n = promo.n
    const padded = /^\d+$/.test(n) ? n.padStart(3, '0') : n
    add(await queryCards(`set.id:${promo.setId} number:${n}`, apiKey), `set.id:${promo.setId} number:${n}`, 'exact')
    if (padded !== n) {
      add(await queryCards(`set.id:${promo.setId} number:${padded}`, apiKey), `set.id:${promo.setId} number:${padded}`, 'exact')
    }
  }

  const nameTokens = Array.from(new Set([query.name, ...raw.names].filter((n): n is string => Boolean(n && n.length >= 3))))
  let effective: ScanQuery = query

  if ((!seen.size || !query.number) && raw.reads.length && raw.reads[0].number !== query.number) {
    const r = raw.reads[0]
    effective = { ...query, number: r.number, total: r.total, kind: r.kind, setCode: r.setCode || query.setCode, alts: raw.reads.slice(1, 3) }
    await runTries(effective, 'raw-text')
  }

  const total = effective.total ?? raw.reads.find((r) => r.total)?.total
  if (!seen.size && total && !promoLock) {
    const matching = (sets.length ? sets : await allSets(apiKey)).filter((s) => String(s.printedTotal) === total)
    for (const set of matching.slice(0, 3)) {
      const rows = await queryCards(`set.id:${set.id}`, apiKey, 250)
      const ranked = rows
        .map((c) => ({ c, s: Math.max(0, ...nameTokens.map((n) => nameSim(n, c.name))) + (effective.number && c.number === effective.number ? 1 : 0) }))
        .sort((a, b) => b.s - a.s)
        .slice(0, 8)
      add(ranked.map((x) => x.c), `set.id:${set.id}`, 'set-total')
    }
  }

  const weak = seen.size > 0 && !Array.from(seen.values()).some((c) =>
    (effective.number && c.number === effective.number) || nameTokens.some((n) => nameSim(n, c.name) >= 0.75))
  if (weak) { seen.clear(); used = undefined; stage = 'none' }

  if (promoLock && promo.setId) {
    const locked = Array.from(seen.values()).filter((c) => c.set?.id?.toLowerCase() === promo.setId)
    seen.clear()
    if (locked.length) {
      for (const card of locked) seen.set(card.id, card)
    } else {
      used = undefined
      stage = 'none'
    }
  }

  if (!seen.size && nameTokens.length && !promoLock) {
    const pool = new Map<string, TcgCard>()
    for (const len of [4, 3]) {
      for (const token of nameTokens.slice(0, 3)) {
        const t = token.toLowerCase().replace(/[^a-z]/g, '')
        const subs = new Set([t.slice(0, len), t.slice(-len), t.slice(1, 1 + len)].filter((x) => x.length === len))
        for (const sub of Array.from(subs)) for (const c of await queryCards(`name:*${sub}*`, apiKey, 100)) pool.set(c.id, c)
      }
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
      add(await queryCards(`number:${n}`, apiKey), `number:${n}`, 'number-only')
      if (seen.size) break
    }
  }

  const scored = rankCards(Array.from(seen.values()), effective)
  const top = scored[0]
  const gap = top ? top.score - (scored[1]?.score ?? 0) : 0
  let confidence = top ? Number(Math.min(1, top.score - (gap < 0.1 ? 0.15 : 0)).toFixed(2)) : 0
  if (stage !== 'exact' && stage !== 'raw-text') confidence = Math.min(confidence, 0.6)

  return {
    best: confidence >= BEST_THRESHOLD ? top : null,
    candidates: scored.slice(0, 8),
    confidence,
    ocr: { name: query.name, number: effective.number, total: effective.total },
    query: used,
    stage,
  }
}
