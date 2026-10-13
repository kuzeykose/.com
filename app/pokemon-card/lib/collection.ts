import { readFileSync, writeFileSync } from 'fs'
import path from 'path'
import {
  CONDITIONS,
  type CatalogSnapshot,
  type CollectionEntry,
  type CollectionFile,
  type EnrichedCard,
  type TcgCard,
} from './types'
import { fetchCardById, fetchCardsByIds } from './tcg'
import { quoteFor, usdMarket } from './prices'

export const COLLECTION_PATH = path.join(process.cwd(), 'data/pokemon-card.json')

export function isWritable() {
  return process.env.NODE_ENV === 'development'
}

export function readCollection(): CollectionFile {
  const raw = readFileSync(COLLECTION_PATH, 'utf8')
  const parsed = JSON.parse(raw) as CollectionFile
  const cards = Array.isArray(parsed.cards) ? parsed.cards : []
  return { cards: cards.filter(isEntry) }
}

function isEntry(value: CollectionEntry): value is CollectionEntry {
  return (
    Boolean(value) &&
    typeof value.id === 'string' &&
    typeof value.quantity === 'number' &&
    CONDITIONS.includes(value.condition) &&
    typeof value.added === 'string'
  )
}

export async function getEnrichedCollection(): Promise<EnrichedCard[]> {
  const { cards } = readCollection()
  const tcgById = await fetchCardsByIds(cards.map((card) => card.id))
  return cards.map((entry) => enrich(entry, tcgById.get(entry.id) ?? null))
}

export async function getEnrichedCard(id: string): Promise<EnrichedCard | null> {
  const entry = readCollection().cards.find((card) => card.id === id)
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
    const guessed = guessFromId(entry.id)
    if (!guessed) return null
    return guessed
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

export function writeCollection(file: CollectionFile) {
  writeFileSync(COLLECTION_PATH, `${JSON.stringify(file, null, 2)}\n`, 'utf8')
}

export function upsertCard(
  incoming: CollectionEntry,
  mode: 'add' | 'edit' | 'undo'
): CollectionFile {
  const file = readCollection()
  const index = file.cards.findIndex((card) => card.id === incoming.id)

  if (mode === 'undo') {
    if (index === -1) return file
    const current = file.cards[index]
    const quantity = current.quantity - incoming.quantity
    if (quantity <= 0) file.cards.splice(index, 1)
    else file.cards[index] = { ...current, quantity }
    writeCollection(file)
    return file
  }

  if (index === -1) {
    file.cards.unshift({
      ...incoming,
      added: incoming.added || new Date().toISOString().slice(0, 10),
    })
    writeCollection(file)
    return file
  }

  const current = file.cards[index]
  const quantity =
    mode === 'add' ? current.quantity + incoming.quantity : incoming.quantity

  if (quantity <= 0) {
    file.cards.splice(index, 1)
  } else {
    file.cards[index] = {
      ...current,
      quantity,
      condition: incoming.condition,
      printing: incoming.printing ?? current.printing,
      notes: incoming.notes ?? current.notes,
      catalog: incoming.catalog ?? current.catalog,
    }
  }

  writeCollection(file)
  return file
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
