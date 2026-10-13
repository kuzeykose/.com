import { TCGDEX_API } from './constants'
import type { TcgAbility, TcgAttack, TcgCard } from './types'

const CACHE_TTL = 24 * 3600 * 1000
const cache = new Map<string, { t: number; data: unknown }>()

type TcgdexSet = {
  id?: string
  name?: string
  cardCount?: { official?: number; total?: number }
  serie?: { id?: string; name?: string }
}

type TcgdexCard = {
  id?: string
  localId?: string | number
  name?: string
  hp?: number | string
  rarity?: string
  types?: string[]
  image?: string
  illustrator?: string
  attacks?: Array<{ name?: string; damage?: string | number; effect?: string }>
  abilities?: Array<{ name?: string; effect?: string; type?: string }>
  set?: TcgdexSet
  variants?: { holo?: boolean; normal?: boolean; reverse?: boolean }
  variants_detailed?: Array<{
    type?: string
    thirdParty?: { tcgplayer?: number | string; cardmarket?: number | string }
  }>
}

function headers() {
  return { Accept: 'application/json', 'User-Agent': 'kuzeykose.com pokemon-card' }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function tcgdexGet<T>(path: string): Promise<T | null> {
  const url = path.startsWith('http') ? path : `${TCGDEX_API}${path}`
  const hit = cache.get(url)
  if (hit && Date.now() - hit.t < CACHE_TTL) return hit.data as T

  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers: headers() }).catch(() => null)
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

/** pokemontcg.io-style id: `{setId}-{number}` with leading zeros stripped. */
export function canonicalCardId(setId: string, number: string) {
  const n = /^\d+$/.test(number) ? String(Number(number)) : number
  return `${setId.toLowerCase()}-${n}`
}

export function cardIdVariants(id: string) {
  const match = id.trim().match(/^([a-z0-9.]+)-(.+)$/i)
  if (!match) return [id]
  const setId = match[1].toLowerCase()
  const number = match[2]
  const out = new Set([id, `${setId}-${number}`])
  if (/^\d+$/.test(number)) {
    out.add(`${setId}-${String(Number(number))}`)
    out.add(`${setId}-${number.padStart(3, '0')}`)
  }
  return Array.from(out)
}

export function canonicalNumber(value: string | number) {
  const text = String(value)
  return /^\d+$/.test(text) ? String(Number(text)) : text
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

export function tcgdexToTcgCard(card: TcgdexCard): TcgCard | null {
  const setId = card.set?.id?.toLowerCase() || card.id?.split('-')[0]
  const localId = card.localId != null ? String(card.localId) : card.id?.split('-').slice(1).join('-')
  if (!setId || !localId || !card.name) return null
  const number = canonicalNumber(localId)
  const printed = card.set?.cardCount?.official || card.set?.cardCount?.total || 0
  const hp = card.hp != null ? String(card.hp) : undefined
  return {
    id: canonicalCardId(setId, number),
    name: card.name,
    number,
    hp,
    rarity: card.rarity,
    types: card.types,
    attacks: attacksOf(card),
    abilities: abilitiesOf(card),
    images: imagesOf(card),
    set: {
      id: setId,
      name: card.set?.name ?? setId.toUpperCase(),
      printedTotal: printed || undefined,
      series: card.set?.serie?.name,
    },
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

export async function fetchTcgdexPromo(setId: string, number: string): Promise<TcgCard | null> {
  const set = setId.toLowerCase()
  const n = canonicalNumber(number)
  const padded = /^\d+$/.test(n) ? n.padStart(3, '0') : n
  const tries = Array.from(new Set([`${set}-${n}`, `${set}-${padded}`, `${set}-${number}`]))
  for (const id of tries) {
    const card = await fetchTcgdexCard(id)
    if (card && card.set.id === set) return card
  }
  for (const local of Array.from(new Set([padded, n]))) {
    const raw = await tcgdexGet<TcgdexCard>(`/sets/${encodeURIComponent(set)}/${encodeURIComponent(local)}`)
    const card = raw ? tcgdexToTcgCard(raw) : null
    if (card && card.set.id === set) return card
  }
  return null
}

export function clearTcgdexCache() {
  cache.clear()
}
