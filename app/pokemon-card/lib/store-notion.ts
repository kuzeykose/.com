import type { CollectionEntry } from './types.ts'
import type { CardStore } from './store.ts'
import {
  NOTION_PROPS,
  POKEMON_DATABASE_PROPERTIES,
  createNotionClient,
  createThrottle,
  entryToProperties,
  mergeEntry,
  notionDatabaseId,
  notionToken,
  pageToEntry,
  withNotionRetry,
  type NotionClientLike,
  type NotionDatabaseLike,
  type NotionPageLike,
} from './notion.ts'

export type NotionStoreOptions = {
  client: NotionClientLike
  databaseId: string
  dataSourceId?: string
  throttle?: () => Promise<void>
  sleep?: (ms: number) => Promise<unknown>
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function withAdded(entry: CollectionEntry): CollectionEntry {
  return { ...entry, added: entry.added || today() }
}

export async function createPokemonDatabase(
  client: NotionClientLike,
  parentPageId: string
): Promise<NotionDatabaseLike> {
  return client.databases.create({
    parent: { type: 'page_id', page_id: parentPageId },
    title: [{ type: 'text', text: { content: 'Pokémon cards' } }],
    initial_data_source: { properties: POKEMON_DATABASE_PROPERTIES },
  })
}

export function createNotionStore(options: NotionStoreOptions): CardStore {
  const throttle = options.throttle ?? createThrottle()
  let dataSourceIdPromise: Promise<string> | null = null

  async function call<T>(fn: () => Promise<T>): Promise<T> {
    await throttle()
    return withNotionRetry(fn, { sleep: options.sleep })
  }

  async function dataSourceId() {
    if (options.dataSourceId) return options.dataSourceId
    if (!dataSourceIdPromise) {
      dataSourceIdPromise = call(async () => {
        const database = await options.client.databases.retrieve({
          database_id: options.databaseId,
        })
        const id = database.data_sources?.[0]?.id
        if (!id) {
          throw new Error('Notion database has no data source. Share it with the integration and try again.')
        }
        return id
      }).catch((error) => {
        dataSourceIdPromise = null
        throw error
      })
    }
    return dataSourceIdPromise
  }

  async function queryByCardId(id: string) {
    const source = await dataSourceId()
    const result = await call(() =>
      options.client.dataSources.query({
        data_source_id: source,
        page_size: 1,
        filter: {
          property: NOTION_PROPS.cardId,
          rich_text: { equals: id },
        },
      })
    )
    return result.results.find((page) => page.object !== 'data_source') ?? null
  }

  async function writePage(page: NotionPageLike | null, entry: CollectionEntry) {
    const properties = entryToProperties(entry)
    if (!page) {
      const source = await dataSourceId()
      const created = await call(() =>
        options.client.pages.create({
          parent: { data_source_id: source },
          properties,
        })
      )
      return pageToEntry({ ...created, properties: created.properties ?? properties }) ?? entry
    }
    const updated = await call(() =>
      options.client.pages.update({
        page_id: page.id,
        properties,
      })
    )
    return pageToEntry({ ...updated, properties: updated.properties ?? properties }) ?? entry
  }

  return {
    kind: 'notion',
    canWrite() {
      return true
    },
    async list() {
      const source = await dataSourceId()
      const cards: CollectionEntry[] = []
      let cursor: string | undefined
      do {
        const page = await call(() =>
          options.client.dataSources.query({
            data_source_id: source,
            start_cursor: cursor,
            page_size: 100,
          })
        )
        for (const row of page.results) {
          if (row.object === 'data_source') continue
          const entry = pageToEntry(row)
          if (entry) cards.push(entry)
        }
        cursor = page.has_more && page.next_cursor ? page.next_cursor : undefined
      } while (cursor)
      return cards
    },
    async get(id) {
      const page = await queryByCardId(id)
      return page ? pageToEntry(page) : null
    },
    async add(incoming) {
      const next = withAdded(incoming)
      const page = await queryByCardId(next.id)
      if (!page) return writePage(null, next)
      const current = pageToEntry(page)
      if (!current) return writePage(page, next)
      return writePage(page, mergeEntry(current, next, current.quantity + next.quantity))
    },
    async put(incoming) {
      const next = withAdded(incoming)
      const page = await queryByCardId(next.id)
      const entry = await writePage(page, page ? { ...pageToEntry(page), ...next, added: next.added } : next)
      return { entry, created: !page }
    },
    async update(id, patch) {
      const page = await queryByCardId(id)
      if (!page) return null
      const current = pageToEntry(page)
      if (!current) return null
      const next: CollectionEntry = {
        ...current,
        quantity: patch.quantity ?? current.quantity,
        condition: patch.condition ?? current.condition,
        notes: patch.notes ?? current.notes,
        printing: patch.printing ?? current.printing,
        catalog: patch.catalog ?? current.catalog,
      }
      return writePage(page, next)
    },
    async remove(id) {
      const page = await queryByCardId(id)
      if (!page) return false
      await call(() =>
        options.client.pages.update({
          page_id: page.id,
          archived: true,
        })
      )
      return true
    },
    async undo(id, quantity) {
      const page = await queryByCardId(id)
      if (!page) return null
      const current = pageToEntry(page)
      if (!current) return null
      const nextQuantity = current.quantity - quantity
      if (nextQuantity <= 0) {
        await call(() =>
          options.client.pages.update({
            page_id: page.id,
            archived: true,
          })
        )
        return null
      }
      return writePage(page, { ...current, quantity: nextQuantity })
    },
  }
}

let cachedStore: CardStore | null = null

export function getNotionStore(): CardStore {
  if (!cachedStore) {
    cachedStore = createNotionStore({
      client: createNotionClient(notionToken()) as unknown as NotionClientLike,
      databaseId: notionDatabaseId(),
    })
  }
  return cachedStore
}

export function resetNotionStoreForTests() {
  cachedStore = null
}
