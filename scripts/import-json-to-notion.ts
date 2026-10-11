/**
 * One-off import of data/pokemon-card.json into the Notion collection database.
 * Safe to run twice: each Card ID is upserted (create or replace), never duplicated
 * and never incremented.
 *
 * Required:
 *   NOTION_TOKEN              internal integration token
 *
 * One of:
 *   NOTION_POKEMON_DB_ID      existing database id (share it with the integration)
 *   NOTION_PARENT_PAGE_ID     parent page id — the script creates the database
 *
 * Usage:
 *   NOTION_TOKEN=secret_... NOTION_POKEMON_DB_ID=... pnpm import-notion
 */
import { readFileSync } from 'fs'
import path from 'path'
import { createNotionClient, type NotionClientLike } from '../app/pokemon-card/lib/notion.ts'
import { createNotionStore, createPokemonDatabase } from '../app/pokemon-card/lib/store-notion.ts'
import type { CollectionFile } from '../app/pokemon-card/lib/types.ts'

function required(name: string) {
  const value = process.env[name]?.trim()
  if (!value) {
    console.error(`${name} is required`)
    process.exit(1)
  }
  return value
}

function optional(name: string) {
  return process.env[name]?.trim() || ''
}

function readCards() {
  const file = path.join(process.cwd(), 'data/pokemon-card.json')
  const parsed = JSON.parse(readFileSync(file, 'utf8')) as CollectionFile
  const cards = Array.isArray(parsed.cards) ? parsed.cards : []
  if (cards.length === 0) {
    console.error(`No cards found in ${file}`)
    process.exit(1)
  }
  return cards
}

async function main() {
  const token = required('NOTION_TOKEN')
  let databaseId = optional('NOTION_POKEMON_DB_ID')
  const parentPageId = optional('NOTION_PARENT_PAGE_ID')
  const client = createNotionClient(token) as unknown as NotionClientLike

  if (!databaseId) {
    if (!parentPageId) {
      console.error('Set NOTION_POKEMON_DB_ID or NOTION_PARENT_PAGE_ID')
      process.exit(1)
    }
    const created = await createPokemonDatabase(client, parentPageId)
    databaseId = created.id || ''
    if (!databaseId) {
      console.error('Notion created a database but did not return an id')
      process.exit(1)
    }
    console.log(`Created Notion database ${databaseId}`)
    console.log('Set NOTION_POKEMON_DB_ID to this value so the app and later imports reuse it.')
  }

  const store = createNotionStore({ client, databaseId })
  const cards = readCards()
  let created = 0
  let updated = 0

  for (const card of cards) {
    const result = await store.put(card)
    if (result.created) created += 1
    else updated += 1
    console.log(`${result.created ? 'created' : 'updated'} ${card.id} · ${card.catalog?.name ?? card.id}`)
  }

  console.log(`Done. ${created} created, ${updated} updated, ${cards.length} total.`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
