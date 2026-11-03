/**
 * Import a Collectr portfolio export into the collection.
 *
 * In the Collectr app: Portfolio → ⋯ → Export, then save the emailed CSV.
 *
 *   pnpm import:collectr path/to/export.csv            # add / update cards
 *   pnpm import:collectr path/to/export.csv --dry-run  # show what would change
 *   pnpm import:collectr path/to/export.csv --prune    # also remove cards not in the export
 *   pnpm import:collectr export.csv --set "Pitch Black=me05"   # force a set id
 *
 * Writes to Notion when NOTION_TOKEN and NOTION_POKEMON_DB_ID are set,
 * otherwise to data/pokemon-card.json. Each card is upserted by its TCGdex id,
 * so re-running with a fresh export updates quantities instead of duplicating.
 * Price columns in the export are ignored.
 */
import { readFileSync } from 'node:fs'
import {
  catalogFromCard,
  mapPrinting,
  mergeRows,
  normalizeSetName,
  parseCollectrCsv,
  rowNotes,
  type CollectrRow,
} from '../app/pokemon-card/lib/collectr.ts'
import { getCardStore } from '../app/pokemon-card/lib/store.ts'
import {
  fetchSetCard,
  fetchSets,
  padLocalId,
  searchTcgdexCards,
} from '../app/pokemon-card/lib/tcgdex.ts'
import type { CatalogSnapshot, CollectionEntry, TcgCard, TcgSet } from '../app/pokemon-card/lib/types.ts'

type Args = { file: string; dryRun: boolean; prune: boolean; setOverrides: Map<string, string> }

function parseArgs(argv: string[]): Args {
  const args: Args = { file: '', dryRun: false, prune: false, setOverrides: new Map() }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--dry-run') args.dryRun = true
    else if (arg === '--prune') args.prune = true
    else if (arg === '--set') {
      const [name, id] = (argv[(i += 1)] ?? '').split('=')
      if (name && id) args.setOverrides.set(normalizeSetName(name), id.trim())
    } else if (!args.file) args.file = arg
  }
  if (!args.file) {
    console.error('Usage: pnpm import:collectr <export.csv> [--dry-run] [--prune] [--set "Name=id"]')
    process.exit(1)
  }
  return args
}

function simpleName(name: string) {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '')
}

function sameCard(card: TcgCard, row: CollectrRow) {
  const a = simpleName(card.name)
  const b = simpleName(row.name)
  return a === b || a.startsWith(b) || b.startsWith(a)
}

/** Sets already confirmed on TCGdex, used when the set list can't be fetched. */
const KNOWN_SETS: Record<string, string> = {
  'chaos rising': 'me04',
  'perfect order': 'me03',
}

function findSet(row: CollectrRow, sets: TcgSet[], overrides: Map<string, string>) {
  const wanted = normalizeSetName(row.set)
  const forced = overrides.get(wanted) ?? (sets.length ? undefined : KNOWN_SETS[wanted])
  if (forced) return sets.find((set) => set.id === forced) ?? { id: forced, name: row.set }
  const exact = sets.filter((set) => normalizeSetName(set.name) === wanted)
  if (exact.length === 1) return exact[0]
  // Same name in several series (e.g. "Base Set"): prefer the printed total match.
  const pool = exact.length ? exact : sets.filter((set) => normalizeSetName(set.name).includes(wanted))
  if (row.printedTotal) {
    const byTotal = pool.find((set) => set.printedTotal === row.printedTotal)
    if (byTotal) return byTotal
  }
  return pool[0] ?? null
}

async function findCard(row: CollectrRow, setId: string | null) {
  if (setId) {
    const direct = await fetchSetCard(setId, row.number)
    if (direct && sameCard(direct, row)) return direct
    const named = await searchTcgdexCards({ name: row.name, set: setId }, 30)
    const byNumber = named.find((card) => padLocalId(card.number) === padLocalId(row.number))
    if (byNumber) return byNumber
    if (direct) return direct
  }
  const anywhere = await searchTcgdexCards({ name: row.name, localId: padLocalId(row.number) }, 10)
  return anywhere.find((card) => sameCard(card, row)) ?? null
}

function slug(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function fallbackCatalog(row: CollectrRow, setId?: string): CatalogSnapshot {
  // TCGdex asset path is /<lang>/<series>/<set>/<number>; only guess it for known series.
  const series = setId?.match(/^(me|sv)\d/)?.[1]
  const base = series ? `https://assets.tcgdex.net/en/${series}/${setId}/${padLocalId(row.number)}` : null
  return {
    image: base ? `${base}/low.webp` : undefined,
    imageLarge: base ? `${base}/high.webp` : undefined,
    name: row.name,
    number: row.number,
    rarity: row.rarity,
    setId,
    setName: row.set,
    printedTotal: row.printedTotal,
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const rows = mergeRows(parseCollectrCsv(readFileSync(args.file, 'utf8')))
  if (!rows.length) {
    console.error('No Pokémon cards found in the export.')
    process.exit(1)
  }

  const store = getCardStore()
  console.log(`${rows.length} cards in export · writing to ${store.kind}${args.dryRun ? ' (dry run)' : ''}\n`)

  const sets = await fetchSets()
  if (!sets.length) console.warn('Could not load TCGdex sets; cards will be stored without images.\n')

  const existing = new Map((await store.list()).map((entry) => [entry.id, entry]))
  const seen = new Set<string>()
  const unmatched: string[] = []
  let created = 0
  let updated = 0

  for (const row of rows) {
    const set = findSet(row, sets, args.setOverrides)
    const card = await findCard(row, set?.id ?? null)
    const fallbackId = `collectr-${slug(row.set)}-${padLocalId(row.number)}`
    const id = card?.id ?? (set ? `${set.id}-${padLocalId(row.number)}` : fallbackId)
    const printing = mapPrinting(row.variance)
    const catalog = card ? catalogFromCard(card) : fallbackCatalog(row, set?.id)
    const previous = existing.get(id) ?? existing.get(fallbackId)

    const entry: CollectionEntry = {
      id,
      quantity: row.quantity,
      condition: row.condition,
      printing,
      notes: rowNotes(row) ?? previous?.notes,
      added: previous?.added ?? row.added ?? new Date().toISOString().slice(0, 10),
      catalog,
    }
    seen.add(id)

    const label = `${row.name} · ${row.set} ${row.number}${row.printedTotal ? `/${row.printedTotal}` : ''}`
    if (!card) unmatched.push(`${label}  →  stored as ${id}`)
    const status = existing.has(id) ? 'update' : 'create'
    console.log(`${status.padEnd(6)} ${card ? '✓' : '?'} ${id.padEnd(22)} ${label} ×${row.quantity}`)

    if (status === 'create') created += 1
    else updated += 1
    if (args.dryRun) continue
    await store.put(entry)
    // A card that was stored under a fallback id before now resolves: drop the stale copy.
    if (id !== fallbackId && existing.has(fallbackId)) await store.remove(fallbackId)
  }

  let removed = 0
  if (args.prune) {
    for (const id of existing.keys()) {
      if (seen.has(id)) continue
      console.log(`remove   ${id} · ${existing.get(id)?.catalog?.name ?? ''}`)
      if (!args.dryRun) await store.remove(id)
      removed += 1
    }
  }

  console.log(
    `\n${args.dryRun ? 'Would write' : 'Done'}: ${created} created, ${updated} updated${args.prune ? `, ${removed} removed` : ''}.`
  )
  if (unmatched.length) {
    console.log(`\n${unmatched.length} not found on TCGdex (kept with Collectr details, no image yet):`)
    for (const line of unmatched) console.log(`  ${line}`)
    console.log('Re-run later once TCGdex has them, or force a set with --set "Set Name=tcgdexId".')
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
