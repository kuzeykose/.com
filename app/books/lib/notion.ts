import { Client } from '@notionhq/client'
import { pageToBook, type Book, type NotionPageLike } from './map'

export const BOOKS_REVALIDATE = 3600
export const BOOKS_CACHE_TAG = 'books'

export function notionToken() {
  return process.env.NOTION_TOKEN?.trim() || ''
}

export function notionBooksDatabaseId() {
  return process.env.NOTION_BOOKS_DB_ID?.trim() || ''
}

export function isBooksConfigured() {
  return Boolean(notionToken() && notionBooksDatabaseId())
}

export type NotionQueryLike = {
  results: NotionPageLike[]
  has_more: boolean
  next_cursor: string | null
}

export type NotionDatabaseLike = {
  id?: string
  data_sources?: Array<{ id: string; name?: string }>
}

export type NotionPageResponse = NotionPageLike & {
  parent?: {
    type?: string
    database_id?: string
    data_source_id?: string
  }
}

export type NotionClientLike = {
  databases: {
    retrieve: (args: { database_id: string }) => Promise<NotionDatabaseLike>
    query?: (args: {
      database_id: string
      start_cursor?: string
      page_size?: number
    }) => Promise<NotionQueryLike>
  }
  dataSources: {
    query: (args: {
      data_source_id: string
      start_cursor?: string
      page_size?: number
    }) => Promise<NotionQueryLike>
  }
  pages: {
    retrieve: (args: { page_id: string }) => Promise<NotionPageResponse>
  }
}

export function createNotionClient(auth = notionToken()): Client {
  if (!auth) throw new Error('NOTION_TOKEN is not set')
  return new Client({
    auth,
    retry: {
      maxRetries: 5,
      initialRetryDelayMs: 400,
      maxRetryDelayMs: 8000,
    },
  })
}

export async function dataSourceIdForDatabase(
  client: NotionClientLike,
  databaseId: string
) {
  const database = await client.databases.retrieve({ database_id: databaseId })
  const id = database.data_sources?.[0]?.id
  if (!id) {
    throw new Error(
      'Notion books database has no data source. Share it with the integration and try again.'
    )
  }
  return id
}

export async function queryBookPages(
  client: NotionClientLike,
  databaseId: string
): Promise<NotionPageLike[]> {
  const pages: NotionPageLike[] = []

  if (typeof client.databases.query === 'function') {
    let cursor: string | undefined
    do {
      const page = await client.databases.query({
        database_id: databaseId,
        start_cursor: cursor,
        page_size: 100,
      })
      for (const row of page.results) {
        if (row.object && row.object !== 'page') continue
        pages.push(row)
      }
      cursor = page.has_more && page.next_cursor ? page.next_cursor : undefined
    } while (cursor)
    return pages
  }

  const dataSourceId = await dataSourceIdForDatabase(client, databaseId)
  let cursor: string | undefined
  do {
    const page = await client.dataSources.query({
      data_source_id: dataSourceId,
      start_cursor: cursor,
      page_size: 100,
    })
    for (const row of page.results) {
      if (row.object && row.object !== 'page') continue
      pages.push(row)
    }
    cursor = page.has_more && page.next_cursor ? page.next_cursor : undefined
  } while (cursor)
  return pages
}

export async function loadBooksFromNotion(
  client: NotionClientLike = createNotionClient() as unknown as NotionClientLike,
  databaseId = notionBooksDatabaseId()
): Promise<Book[]> {
  const pages = await queryBookPages(client, databaseId)
  const books: Book[] = []
  for (const page of pages) {
    const book = pageToBook(page)
    if (book) books.push(book)
  }
  return books
}

export function pageBelongsToBooksDatabase(
  page: NotionPageResponse,
  databaseId: string,
  dataSourceId?: string
) {
  const parent = page.parent
  if (!parent) return false
  if (
    parent.database_id &&
    parent.database_id.replace(/-/g, '') === databaseId.replace(/-/g, '')
  ) {
    return true
  }
  if (dataSourceId && parent.data_source_id === dataSourceId) return true
  return false
}

export async function loadFreshCoverUrl(
  pageId: string,
  client: NotionClientLike = createNotionClient() as unknown as NotionClientLike,
  databaseId = notionBooksDatabaseId()
) {
  const page = await client.pages.retrieve({ page_id: pageId })
  let dataSourceId: string | undefined
  try {
    dataSourceId = await dataSourceIdForDatabase(client, databaseId)
  } catch {
    dataSourceId = undefined
  }
  if (!pageBelongsToBooksDatabase(page, databaseId, dataSourceId)) return null
  return pageToBook(page)
}
