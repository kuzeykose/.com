/**
 * Rewrite stored pokemontcg.io card ids to native TCGdex ids and refresh
 * catalog snapshots (images + tcgplayer/cardmarket prices) from api.tcgdex.net.
 *
 *   pnpm map:tcgdex
 */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { catalogFromCard } from '../app/pokemon-card/lib/collection.ts'
import { clearTcgdexCache, fetchTcgdexCard, toTcgdexId } from '../app/pokemon-card/lib/tcgdex.ts'
import type { CollectionFile } from '../app/pokemon-card/lib/types.ts'

const FILE = path.join(process.cwd(), 'data/pokemon-card.json')

async function main() {
  clearTcgdexCache()
  const file = JSON.parse(readFileSync(FILE, 'utf8')) as CollectionFile
  const cards = []
  for (const entry of file.cards ?? []) {
    const guessed = toTcgdexId(entry.id)
    const live = (await fetchTcgdexCard(entry.id)) || (await fetchTcgdexCard(guessed))
    const id = live?.id || guessed
    const catalog = live ? catalogFromCard(live, entry.printing) : entry.catalog
    cards.push({ ...entry, id, catalog })
    const img = catalog?.image ? 'img' : 'no-img'
    const price =
      catalog?.market != null ? `${catalog.currency ?? 'USD'} ${catalog.market}` : 'unknown'
    console.log(`${entry.id} → ${id}  ${live?.name ?? catalog?.name ?? '?'}  ${img}  ${price}`)
  }
  writeFileSync(FILE, `${JSON.stringify({ cards }, null, 2)}\n`, 'utf8')
  console.log(`wrote ${cards.length} cards to ${FILE}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
