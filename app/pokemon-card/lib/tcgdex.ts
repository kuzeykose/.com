import { PRICE_REVALIDATE, TCGDEX_API } from './constants'
import type { SearchCard, TcgAbility, TcgAttack, TcgCard, TcgPrice, TcgSet } from './types'
import { availablePrintings } from './prices'

const CACHE_TTL = 24 * 3600 * 1000
const cache = new Map<string, { t: number; data: unknown }>()

type TcgdexSet = {
  id?: string
  name?: string
  releaseDate?: string
  cardCount?: { official?: number; total?: number }
  serie?: { id?: string; name?: string }
}

type TcgdexTcgplayerPrices = {
  unit?: string
  updated?: string
  holofoil?: { marketPrice?: number; lowPrice?: number; midPrice?: number; highPrice?: number }
  normal?: { marketPrice?: number; lowPrice?: number; midPrice?: number; highPrice?: number }
  reverseHolofoil?: { marketPrice?: number; lowPrice?: number; midPrice?: number; highPrice?: number }
}

type TcgdexCard = {
  id?: string
  localId?: string | number
  name?: string
  hp?: number | string
  rarity?: string
  types?: string[]
  image?: string
  attacks?: Array<{ name?: string; damage?: string | number; effect?: string }>
  abilities?: Array<{ name?: string; effect?: string; type?: string }>
  set?: TcgdexSet
  variants?: { holo?: boolean; normal?: boolean; reverse?: boolean }
  variants_detailed?: Array<{
    type?: string
    thirdParty?: { tcgplayer?: number | string; cardmarket?: number | string }
  }>
  pricing?: {
    tcgplayer?: TcgdexTcgplayerPrices | null
    cardmarket?: { unit?: string; avg?: number; updated?: string } | null
  }
}

function headers() {
  return { Accept: 'application/json', 'User-Agent': 'kuzeykose.com pokemon-card' }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function tcgdexGet<T>(path: string): Promise<T | null> {
  const url = path.startsWith('http') ? path : `${TCGDEX_API}${path}`
  const hit = cache.get(url)
  if (hit && Date.now() - hit.t < CACHE_TTL) return hit.data as T

  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, {
      headers: headers(),
      next: { revalidate: PRICE_REVALIDATE },
    }).catch(() => null)
    if (res?.ok) {
      const data = (await res.json()) as T
      cache.set(url, { t: Date.now(), data })
      return data
    }
    if (res?.status === 404) return null
    if (!res || res.status === 429 || res.status >= 500) {
      await sleep(400 * 2 ** attempt)
      continue
    }
    return null
  }
  return null
}

/** Older pokemontcg.io set ids → TCGdex set ids. */
export const LEGACY_SET_ID: Record<string, string> = {
  sv8: 'sv08',
  sv8pt5: 'sv08.5',
  sv5: 'sv05',
  sv6: 'sv06',
  sv4: 'sv04',
  sv3pt5: 'sv03.5',
  me1: 'me01',
  me2: 'me02',
  me3: 'me03',
  me4: 'me04',
  me5: 'me05',
}

/**
 * Known collection / scan ids that do not follow a single padding rule
 * (dp1-1 stays unpadded; swsh9-29 becomes swsh9-029).
 */
export const LEGACY_CARD_ID: Record<string, string> = {
  'sv8-40': 'sv08-040',
  'sv8pt5-30': 'sv08.5-030',
  'sv5-81': 'sv05-081',
  'me1-133': 'me01-133',
  'sv6-25': 'sv06-025',
  'sv6-78': 'sv06-078',
  'sv3pt5-199': 'sv03.5-199',
  'sv4-91': 'sv04-091',
  'dp1-1': 'dp1-1',
  'base1-58': 'base1-58',
  'swsh9-29': 'swsh9-029',
  'cel25-24': 'cel25-24',
  'me4-87': 'me04-087',
  'me3-31': 'me03-031',
  'me3-6': 'me03-006',
  'mep-72': 'mep-072',
}

export function canonicalNumber(value: string | number) {
  const text = String(value)
  return /^\d+$/.test(text) ? String(Number(text)) : text
}

export function padLocalId(value: string | number) {
  const text = String(value)
  return /^\d+$/.test(text) ? text.padStart(3, '0') : text
}

export function tcgdexCardId(setId: string, number: string) {
  const set = (LEGACY_SET_ID[setId.toLowerCase()] || setId).toLowerCase()
  return `${set}-${padLocalId(number)}`
}

/** Native TCGdex id (padded localId), including legacy pokemontcg.io set prefixes. */
export function canonicalCardId(setId: string, number: string) {
  return tcgdexCardId(setId, number)
}

/** Rewrite a stored pokemontcg.io id to the native TCGdex id. */
export function toTcgdexId(id: string) {
  const raw = id.trim()
  if (LEGACY_CARD_ID[raw]) return LEGACY_CARD_ID[raw]
  const lower = raw.toLowerCase()
  if (LEGACY_CARD_ID[lower]) return LEGACY_CARD_ID[lower]
  const match = raw.match(/^([a-z0-9.]+)-(.+)$/i)
  if (!match) return raw
  const setId = (LEGACY_SET_ID[match[1].toLowerCase()] || match[1]).toLowerCase()
  const number = match[2]
  const guessed = `${setId}-${/^\d+$/.test(number) ? padLocalId(number) : number}`
  return LEGACY_CARD_ID[guessed] || LEGACY_CARD_ID[`${match[1]}-${number}`] || guessed
}

export function cardIdVariants(id: string) {
  const raw = id.trim()
  const mapped = LEGACY_CARD_ID[raw] || LEGACY_CARD_ID[raw.toLowerCase()]
  const out = new Set<string>()
  if (mapped) out.add(mapped)
  out.add(raw)
  out.add(raw.toLowerCase())
  const match = raw.match(/^([a-z0-9.]+)-(.+)$/i)
  if (match) {
    const setId = (LEGACY_SET_ID[match[1].toLowerCase()] || match[1]).toLowerCase()
    const number = match[2]
    if (/^\d+$/.test(number)) out.add(`${setId}-${number.padStart(3, '0')}`)
    out.add(`${setId}-${number}`)
    if (/^\d+$/.test(number)) out.add(`${setId}-${String(Number(number))}`)
  }
  for (const [legacy, native] of Object.entries(LEGACY_CARD_ID)) {
    if (out.has(native) || native === mapped) out.add(legacy)
  }
  return Array.from(out)
}

function tcgplayerProductId(card: TcgdexCard) {
  for (const row of card.variants_detailed ?? []) {
    const id = row.thirdParty?.tcgplayer
    if (id != null && String(id).trim()) return String(id).trim()
  }
  return ''
}

function imagesOf(card: TcgdexCard): TcgCard['images'] {
  if (card.image) {
    const base = card.image.replace(/\/$/, '')
    return { small: `${base}/low.webp`, large: `${base}/high.webp` }
  }
  const product = tcgplayerProductId(card)
  if (!product) return undefined
  return {
    small: `https://product-images.tcgplayer.com/fit-in/437x437/${product}.jpg`,
    large: `https://tcgplayer-cdn.tcgplayer.com/product/${product}_in_1000x1000.jpg`,
  }
}

function attacksOf(card: TcgdexCard): TcgAttack[] | undefined {
  const rows = (card.attacks ?? [])
    .filter((row) => row.name)
    .map((row) => ({
      name: row.name as string,
      damage: row.damage != null ? String(row.damage) : undefined,
      text: row.effect,
    }))
  return rows.length ? rows : undefined
}

function abilitiesOf(card: TcgdexCard): TcgAbility[] | undefined {
  const rows = (card.abilities ?? [])
    .filter((row) => row.name)
    .map((row) => ({ name: row.name as string, text: row.effect }))
  return rows.length ? rows : undefined
}

function tcgPrice(row?: { marketPrice?: number; lowPrice?: number; midPrice?: number; highPrice?: number }): TcgPrice | undefined {
  if (!row || row.marketPrice == null) return undefined
  return {
    market: row.marketPrice,
    low: row.lowPrice,
    mid: row.midPrice,
    high: row.highPrice,
  }
}

function pricesOf(card: TcgdexCard): TcgCard['tcgplayer'] {
  const block = card.pricing?.tcgplayer
  if (!block) return undefined
  const prices: Record<string, TcgPrice> = {}
  const holo = tcgPrice(block.holofoil)
  const normal = tcgPrice(block.normal)
  const reverse = tcgPrice(block.reverseHolofoil)
  if (holo) prices.holofoil = holo
  if (normal) prices.normal = normal
  if (reverse) prices.reverseHolofoil = reverse
  if (!Object.keys(prices).length) return undefined
  return { updatedAt: block.updated, prices }
}

export function tcgdexToTcgCard(card: TcgdexCard): TcgCard | null {
  const id = card.id
  const setId = card.set?.id || id?.split('-')[0]
  const localId = card.localId != null ? String(card.localId) : id?.split('-').slice(1).join('-')
  if (!id || !setId || !localId || !card.name) return null
  const printed = card.set?.cardCount?.official || card.set?.cardCount?.total || 0
  const market = card.pricing?.cardmarket
  return {
    id,
    name: card.name,
    number: String(localId),
    hp: card.hp != null ? String(card.hp) : undefined,
    rarity: card.rarity,
    types: card.types,
    attacks: attacksOf(card),
    abilities: abilitiesOf(card),
    images: imagesOf(card),
    set: {
      id: setId,
      name: card.set?.name ?? setId,
      printedTotal: printed || undefined,
      series: card.set?.serie?.name,
      releaseDate: card.set?.releaseDate,
    },
    tcgplayer: pricesOf(card),
    cardmarket:
      market?.avg != null
        ? { unit: market.unit === 'EUR' ? 'EUR' : market.unit, avg: market.avg, updatedAt: market.updated }
        : undefined,
    source: 'tcgdex',
  }
}

export function tcgdexPrintings(card: TcgdexCard): string[] {
  const variants = card.variants
  if (!variants) return []
  const keys: string[] = []
  if (variants.holo) keys.push('holofoil')
  if (variants.reverse) keys.push('reverseHolofoil')
  if (variants.normal) keys.push('normal')
  return keys
}

async function getRawCard(id: string): Promise<TcgdexCard | null> {
  for (const variant of cardIdVariants(id)) {
    const card = await tcgdexGet<TcgdexCard>(`/cards/${encodeURIComponent(variant)}`)
    if (card?.id || card?.name) return card
  }
  return null
}

export async function fetchTcgdexCard(id: string): Promise<TcgCard | null> {
  const raw = await getRawCard(id)
  return raw ? tcgdexToTcgCard(raw) : null
}

export async function fetchCardById(id: string): Promise<TcgCard | null> {
  return fetchTcgdexCard(id)
}

export async function fetchCardsByIds(ids: string[]): Promise<Map<string, TcgCard>> {
  const unique = Array.from(new Set(ids.filter(Boolean)))
  const entries = await Promise.all(
    unique.map(async (id) => {
      const card = await fetchTcgdexCard(id)
      return [id, card] as const
    })
  )
  return new Map(entries.filter((entry): entry is readonly [string, TcgCard] => entry[1] != null))
}

export async function fetchSetCard(setId: string, number: string): Promise<TcgCard | null> {
  const set = (LEGACY_SET_ID[setId.toLowerCase()] || setId).toLowerCase()
  const n = canonicalNumber(number)
  const padded = padLocalId(n)
  for (const local of Array.from(new Set([padded, n, number]))) {
    const fromSet = await tcgdexGet<TcgdexCard>(`/sets/${encodeURIComponent(set)}/${encodeURIComponent(local)}`)
    const mapped = fromSet ? tcgdexToTcgCard(fromSet) : null
    if (mapped) return mapped
    const list = await tcgdexGet<TcgdexCard[]>(
      `/cards?set=${encodeURIComponent(set)}&localId=${encodeURIComponent(local)}`
    )
    const brief = list?.[0]
    if (brief?.id) {
      const full = await fetchTcgdexCard(brief.id)
      if (full) return full
    }
  }
  return null
}

export async function fetchTcgdexPromo(setId: string, number: string): Promise<TcgCard | null> {
  return fetchSetCard(setId, number)
}

export type TcgdexSearch = { name?: string; set?: string; localId?: string }

export async function searchTcgdexCards(filter: TcgdexSearch, limit = 20): Promise<TcgCard[]> {
  const params = new URLSearchParams()
  if (filter.name) params.set('name', filter.name)
  if (filter.set) params.set('set', LEGACY_SET_ID[filter.set.toLowerCase()] || filter.set)
  if (filter.localId) params.set('localId', filter.localId)
  if (!params.toString()) return []
  params.set('pagination:page', '1')
  params.set('pagination:itemsPerPage', String(limit))
  const list = (await tcgdexGet<TcgdexCard[]>(`/cards?${params.toString()}`)) ?? []
  const briefs = list.slice(0, limit)
  const full = await Promise.all(briefs.map((row) => (row.id ? fetchTcgdexCard(row.id) : Promise.resolve(null))))
  return full.filter((card): card is TcgCard => Boolean(card))
}

export async function fetchSets(): Promise<TcgSet[]> {
  const list = (await tcgdexGet<TcgdexSet[]>(`/sets`)) ?? []
  return list
    .filter((row) => row.id && row.name)
    .map((row) => ({
      id: row.id as string,
      name: row.name as string,
      printedTotal: row.cardCount?.official || row.cardCount?.total,
      releaseDate: row.releaseDate,
      series: row.serie?.name,
    }))
}

export type SetRow = { id: string; name: string; printedTotal: number; total: number }

export async function listSetRows(): Promise<SetRow[]> {
  const list = (await tcgdexGet<TcgdexSet[]>(`/sets`)) ?? []
  return list
    .filter((row) => row.id)
    .map((row) => ({
      id: row.id as string,
      name: row.name ?? row.id ?? '',
      printedTotal: row.cardCount?.official || 0,
      total: row.cardCount?.total || row.cardCount?.official || 0,
    }))
}

function splitSearch(raw: string) {
  const q = raw.replace(/[+\-&|!(){}[\]^"~*?:\\/]/g, ' ').replace(/\s+/g, ' ').trim()
  const match = q.match(/^(.*?)(?:\s+(\d+[a-zA-Z]*))?$/)
  const name = match?.[1]?.trim() || ''
  let number = match?.[2] || ''
  if (number && /^\d+$/.test(number)) number = String(Number.parseInt(number, 10))
  return { name, number }
}

export function buildSearchQuery(raw: string, setId?: string, includeNumber = true) {
  const { name, number } = splitSearch(raw)
  const parts: string[] = []
  if (name) parts.push(`name=${name}`)
  if (includeNumber && number) parts.push(`localId=${padLocalId(number)}`)
  if (setId) parts.push(`set=${LEGACY_SET_ID[setId.toLowerCase()] || setId}`)
  return parts.join('&')
}

export async function searchCards(raw: string, setId?: string): Promise<SearchCard[]> {
  const { name, number } = splitSearch(raw)
  if (!name && !number && !setId) return []
  let cards = await searchTcgdexCards({
    name: name || undefined,
    set: setId,
    localId: number ? padLocalId(number) : undefined,
  })
  if (!cards.length && number) {
    cards = await searchTcgdexCards({ name: name || undefined, set: setId })
  }
  return cards.map(toSearchCard)
}

function toSearchCard(card: TcgCard): SearchCard {
  const printings = availablePrintings(card)
  const quotes: Record<string, number> = {}
  for (const key of printings) {
    const market = card.tcgplayer?.prices?.[key]?.market
    if (market != null) quotes[key] = market
  }
  let quoteUnit: 'USD' | 'EUR' | undefined
  if (Object.keys(quotes).length) quoteUnit = 'USD'
  if (!Object.keys(quotes).length && card.cardmarket?.avg != null) {
    quotes.cardmarket = card.cardmarket.avg
    quoteUnit = 'EUR'
  }
  return {
    id: card.id,
    name: card.name,
    number: card.number,
    rarity: card.rarity,
    types: card.types,
    setName: card.set?.name ?? '',
    setId: card.set?.id ?? '',
    printedTotal: card.set?.printedTotal,
    image: card.images?.small,
    printings: printings.length ? printings : Object.keys(quotes),
    quotes,
    quoteUnit,
    updatedAt: card.tcgplayer?.updatedAt ?? card.cardmarket?.updatedAt ?? null,
  }
}

export function clearTcgdexCache() {
  cache.clear()
}
