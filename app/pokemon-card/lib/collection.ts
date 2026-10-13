import 'server-only'

import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache'
import {
  type CatalogSnapshot,
  type CollectionEntry,
  type EnrichedCard,
  type TcgCard,
} from './types'
import { fetchCardById, fetchCardsByIds } from './tcg'
import { quoteFor, usdMarket } from './prices'
import { COLLECTION_CACHE_TAG, COLLECTION_REVALIDATE } from './notion'
import { getCardStore, isNotionConfigured } from './store'
import { jsonStore, readJsonCollection } from './store-json'

export { COLLECTION_PATH, readJsonCollection as readCollection } from './store-json'
export { isWritable } from './store'
export { COLLECTION_CACHE_TAG, COLLECTION_REVALIDATE } from './notion'

const loadCollectionEntries = unstable_cache(
  async () => {
    try {
      return await getCardStore().list()
    } catch (error) {
      if (isNotionConfigured()) {
        console.error('Notion collection read failed; falling back to JSON', error)
        return jsonStore.list()
      }
      throw error
    }
  },
  ['pokemon-card-collection'],
  { revalidate: COLLECTION_REVALIDATE, tags: [COLLECTION_CACHE_TAG] }
)

export async function listCollectionEntries(): Promise<CollectionEntry[]> {
  try {
    return await loadCollectionEntries()
  } catch {
    return getCardStore().list().catch(() => readJsonCollection().cards)
  }
}

export function revalidateCollection(id?: string) {
  revalidateTag(COLLECTION_CACHE_TAG, 'max')
  revalidatePath('/pokemon-card')
  revalidatePath('/pokemon-card/collection')
  if (id) revalidatePath(`/pokemon-card/${id}`)
}

export async function getEnrichedCollection(): Promise<EnrichedCard[]> {
  const cards = await listCollectionEntries()
  const tcgById = await fetchCardsByIds(cards.map((card) => card.id))
  return cards.map((entry) => enrich(entry, tcgById.get(entry.id) ?? null))
}

export async function getEnrichedCard(id: string): Promise<EnrichedCard | null> {
  const cards = await listCollectionEntries()
  const entry = cards.find((card) => card.id === id)
  if (!entry) return null
  const tcg = await fetchCardById(id)
  return enrich(entry, tcg)
}

function enrich(entry: CollectionEntry, live: TcgCard | null): EnrichedCard {
  const tcg = live ?? snapshotToCard(entry)
  const liveQuote = live ? quoteFor(live, entry.printing) : null
  const quote =
    liveQuote?.market != null
      ? liveQuote
      : {
          market: entry.catalog?.market ?? liveQuote?.market ?? null,
          variant: entry.printing ?? entry.catalog?.variant ?? liveQuote?.variant ?? null,
          updatedAt: liveQuote?.updatedAt ?? entry.catalog?.updatedAt ?? null,
          unit: entry.catalog?.currency ?? liveQuote?.unit ?? null,
        }
  return { ...entry, tcg, quote }
}

function snapshotToCard(entry: CollectionEntry): TcgCard | null {
  const catalog = entry.catalog
  if (!catalog?.name) {
    return guessFromId(entry.id)
  }
  return {
    id: entry.id,
    name: catalog.name,
    number: catalog.number,
    rarity: catalog.rarity,
    types: catalog.types,
    images: {
      small: catalog.image,
      large: catalog.imageLarge ?? catalog.image,
    },
    set: {
      id: catalog.setId ?? '',
      name: catalog.setName ?? 'Unknown set',
      printedTotal: catalog.printedTotal,
    },
  }
}

function guessFromId(id: string): TcgCard | null {
  const split = id.lastIndexOf('-')
  if (split <= 0) return null
  const setId = id.slice(0, split)
  const number = id.slice(split + 1)
  return {
    id,
    name: id,
    number,
    images: {
      small: `https://assets.tcgdex.net/en/${setId}/${number}/low.webp`,
      large: `https://assets.tcgdex.net/en/${setId}/${number}/high.webp`,
    },
    set: { id: setId, name: setId },
  }
}

export function catalogFromCard(card: TcgCard, printing?: string): CatalogSnapshot {
  const quote = quoteFor(card, printing)
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
    market: quote.market ?? undefined,
    currency: quote.unit ?? undefined,
    variant: quote.variant ?? undefined,
    updatedAt: quote.updatedAt ?? undefined,
  }
}

export function collectionTotals(cards: EnrichedCard[]) {
  const unique = cards.length
  const copies = cards.reduce((sum, card) => sum + card.quantity, 0)
  const value = cards.reduce((sum, card) => {
    const market = usdMarket(card.quote)
    return sum + (market != null ? market * card.quantity : 0)
  }, 0)
  const sets = new Set(
    cards.map((card) => card.tcg?.set.id).filter((id): id is string => Boolean(id))
  )
  return { unique, copies, value, sets: sets.size }
}

