/**
 * Rewrite stored pokemontcg.io card ids to native TCGdex ids and refresh
 * catalog snapshots (images + tcgplayer/cardmarket prices) from api.tcgdex.net.
 *
 *   pnpm map:tcgdex
 */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { quoteFor } from '../app/pokemon-card/lib/prices.ts'
import { clearTcgdexCache, fetchTcgdexCard, toTcgdexId } from '../app/pokemon-card/lib/tcgdex.ts'
import type { CatalogSnapshot, CollectionEntry, CollectionFile, TcgCard } from '../app/pokemon-card/lib/types.ts'

const FILE = path.join(process.cwd(), 'data/pokemon-card.json')

export function catalogFromLive(card: TcgCard, printing?: string): CatalogSnapshot {
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

export async function migrateEntry(entry: CollectionEntry) {
  const guessed = toTcgdexId(entry.id)
  const live = (await fetchTcgdexCard(entry.id)) || (await fetchTcgdexCard(guessed))
  const id = live?.id || guessed
  const catalog = live ? catalogFromLive(live, entry.printing) : entry.catalog
  return { ...entry, id, catalog, live }
}

async function main() {
  clearTcgdexCache()
  const file = JSON.parse(readFileSync(FILE, 'utf8')) as CollectionFile
  const cards = []
  for (const entry of file.cards ?? []) {
    const { live, ...next } = await migrateEntry(entry)
    cards.push(next)
    const img = next.catalog?.image ? 'img' : 'no-img'
    const price =
      next.catalog?.market != null ? `${next.catalog.currency ?? 'USD'} ${next.catalog.market}` : 'unknown'
    console.log(`${entry.id} → ${next.id}  ${live?.name ?? next.catalog?.name ?? '?'}  ${img}  ${price}`)
  }
  writeFileSync(FILE, `${JSON.stringify({ cards }, null, 2)}\n`, 'utf8')
  console.log(`wrote ${cards.length} cards to ${FILE}`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
