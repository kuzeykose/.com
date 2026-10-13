import { PRICE_REVALIDATE, TCG_API } from './constants'
import type { SearchCard, TcgCard, TcgSet } from './types'
import { availablePrintings } from './prices'
import { tcgApiHeaders } from './tcg-key'
import { fetchTcgdexCard } from './tcgdex'

type FetchOptions = {
  revalidate?: number
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function tcgFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const url = path.startsWith('http') ? path : `${TCG_API}${path}`
  let lastError: Error | null = null

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: tcgApiHeaders(),
        next: { revalidate: options.revalidate ?? PRICE_REVALIDATE },
      })
      if (res.ok) {
        return (await res.json()) as T
      }
      lastError = new Error(`Pokémon TCG API ${res.status}`)
      if (res.status < 500 && res.status !== 429) break
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Pokémon TCG API failed')
    }
    await sleep(400 * (attempt + 1))
  }

  throw lastError ?? new Error('Pokémon TCG API failed')
}

export async function fetchCardById(id: string): Promise<TcgCard | null> {
  try {
    const body = await tcgFetch<{ data: TcgCard }>(`/cards/${encodeURIComponent(id)}`)
    if (body.data) return { ...body.data, source: 'pokemontcg' }
  } catch {
    // pokemontcg.io is missing some promo sets (MEP); fall through to TCGdex.
  }
  return fetchTcgdexCard(id)
}

export async function fetchCardsByIds(ids: string[]): Promise<Map<string, TcgCard>> {
  const unique = Array.from(new Set(ids.filter(Boolean)))
  const entries = await Promise.all(
    unique.map(async (id) => [id, await fetchCardById(id)] as const)
  )
  return new Map(entries.filter((entry): entry is readonly [string, TcgCard] => entry[1] != null))
}

function sanitizeQuery(value: string) {
  return value.replace(/[+\-&|!(){}[\]^"~*?:\\/]/g, ' ').replace(/\s+/g, ' ').trim()
}

function splitSearch(raw: string) {
  const q = sanitizeQuery(raw)
  const match = q.match(/^(.*?)(?:\s+(\d+[a-zA-Z]*))?$/)
  const name = match?.[1]?.trim() || ''
  let number = match?.[2] || ''
  if (number && /^\d+$/.test(number)) number = String(Number.parseInt(number, 10))
  return { name, number }
}

export function buildSearchQuery(raw: string, setId?: string, includeNumber = true) {
  const { name, number } = splitSearch(raw)
  const parts: string[] = []
  if (name) parts.push(`name:"${name}*"`)
  if (includeNumber && number) parts.push(`number:${number}`)
  if (setId) parts.push(`set.id:${setId}`)
  return parts.join(' ')
}

async function runCardSearch(query: string) {
  const params = new URLSearchParams({
    q: query,
    pageSize: '20',
    orderBy: '-set.releaseDate',
  })
  const body = await tcgFetch<{ data: TcgCard[] }>(`/cards?${params}`, {
    revalidate: 3600,
  })
  return (body.data ?? []).map(toSearchCard)
}

export async function searchCards(raw: string, setId?: string): Promise<SearchCard[]> {
  const query = buildSearchQuery(raw, setId)
  if (!query) return []

  const first = await runCardSearch(query)
  if (first.length) return first

  const { number } = splitSearch(raw)
  if (number) {
    const fallback = buildSearchQuery(raw, setId, false)
    if (fallback && fallback !== query) return runCardSearch(fallback)
  }
  return []
}

export async function fetchSets(): Promise<TcgSet[]> {
  const params = new URLSearchParams({
    pageSize: '250',
    orderBy: '-releaseDate',
  })
  const body = await tcgFetch<{ data: TcgSet[] }>(`/sets?${params}`, {
    revalidate: PRICE_REVALIDATE,
  })
  return body.data ?? []
}

function toSearchCard(card: TcgCard): SearchCard {
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
    rarity: card.rarity,
    types: card.types,
    setName: card.set?.name ?? '',
    setId: card.set?.id ?? '',
    printedTotal: card.set?.printedTotal,
    image: card.images?.small,
    printings,
    quotes,
    updatedAt: card.tcgplayer?.updatedAt ?? null,
  }
}
