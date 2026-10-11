import { APIErrorCode, Client, isNotionClientError } from '@notionhq/client'
import { CONDITIONS, type CatalogSnapshot, type CollectionEntry, type Condition } from './types.ts'

export const COLLECTION_CACHE_TAG = 'pokemon-card-collection'
export const COLLECTION_REVALIDATE = 300

export function notionToken() {
  return process.env.NOTION_TOKEN?.trim() || ''
}

export function notionDatabaseId() {
  return process.env.NOTION_POKEMON_DB_ID?.trim() || ''
}

export function isNotionConfigured() {
  return Boolean(notionToken() && notionDatabaseId())
}

export const NOTION_PROPS = {
  name: 'Name',
  cardId: 'Card ID',
  set: 'Set',
  number: 'Number',
  rarity: 'Rarity',
  type: 'Type',
  quantity: 'Quantity',
  condition: 'Condition',
  notes: 'Notes',
  added: 'Added',
} as const

export const POKEMON_DATABASE_PROPERTIES = {
  [NOTION_PROPS.name]: { title: {} },
  [NOTION_PROPS.cardId]: { rich_text: {} },
  [NOTION_PROPS.set]: { rich_text: {} },
  [NOTION_PROPS.number]: { rich_text: {} },
  [NOTION_PROPS.rarity]: { rich_text: {} },
  [NOTION_PROPS.type]: { rich_text: {} },
  [NOTION_PROPS.quantity]: { number: { format: 'number' as const } },
  [NOTION_PROPS.condition]: {
    select: {
      options: CONDITIONS.map((name) => ({ name })),
    },
  },
  [NOTION_PROPS.notes]: { rich_text: {} },
  [NOTION_PROPS.added]: { date: {} },
}

export const NOTION_MIN_GAP_MS = 350
export const NOTION_MAX_RETRIES = 6

export type NotionPageLike = {
  id: string
  object?: string
  archived?: boolean
  in_trash?: boolean
  properties?: Record<string, unknown>
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

export type NotionClientLike = {
  databases: {
    retrieve: (args: { database_id: string }) => Promise<NotionDatabaseLike>
    create: (args: {
      parent: { type: 'page_id'; page_id: string }
      title?: Array<{ type: 'text'; text: { content: string } }>
      initial_data_source?: { properties: Record<string, unknown> }
    }) => Promise<NotionDatabaseLike>
  }
  dataSources: {
    query: (args: {
      data_source_id: string
      start_cursor?: string
      page_size?: number
      filter?: unknown
    }) => Promise<NotionQueryLike>
  }
  pages: {
    create: (args: {
      parent: { data_source_id: string }
      properties: Record<string, unknown>
    }) => Promise<NotionPageLike>
    update: (args: {
      page_id: string
      properties?: Record<string, unknown>
      archived?: boolean
      in_trash?: boolean
    }) => Promise<NotionPageLike>
  }
}

export function createNotionClient(auth = process.env.NOTION_TOKEN): Client {
  if (!auth?.trim()) throw new Error('NOTION_TOKEN is not set')
  return new Client({
    auth: auth.trim(),
    retry: {
      maxRetries: 5,
      initialRetryDelayMs: 400,
      maxRetryDelayMs: 8000,
    },
  })
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function isRateLimited(error: unknown) {
  if (isNotionClientError(error) && error.code === APIErrorCode.RateLimited) return true
  if (error && typeof error === 'object' && 'status' in error) {
    return (error as { status?: number }).status === 429
  }
  return false
}

export function retryAfterMs(error: unknown, attempt: number) {
  if (error && typeof error === 'object' && 'headers' in error) {
    const headers = (error as { headers?: { get?: (name: string) => string | undefined } }).headers
    const raw = headers?.get?.('retry-after')
    const seconds = raw ? Number(raw) : NaN
    if (Number.isFinite(seconds) && seconds >= 0) return Math.max(200, seconds * 1000)
  }
  return Math.min(400 * 2 ** attempt, 8000)
}

export async function withNotionRetry<T>(
  fn: () => Promise<T>,
  options: {
    sleep?: (ms: number) => Promise<unknown>
    maxRetries?: number
    onRetry?: (wait: number, attempt: number) => void
  } = {}
): Promise<T> {
  const waitFn = options.sleep ?? sleep
  const maxRetries = options.maxRetries ?? NOTION_MAX_RETRIES
  let lastError: unknown
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (!isRateLimited(error) || attempt === maxRetries - 1) throw error
      const wait = retryAfterMs(error, attempt)
      options.onRetry?.(wait, attempt)
      await waitFn(wait)
    }
  }
  throw lastError
}

export function createThrottle(minGapMs = NOTION_MIN_GAP_MS, wait = sleep) {
  let lastAt = 0
  return async function throttle() {
    const now = Date.now()
    const pause = lastAt + minGapMs - now
    if (pause > 0) await wait(pause)
    lastAt = Date.now()
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function richPlainText(value: unknown) {
  const prop = asRecord(value)
  if (!prop) return ''
  const items =
    (Array.isArray(prop.title) && prop.title) ||
    (Array.isArray(prop.rich_text) && prop.rich_text) ||
    []
  return items
    .map((item) => {
      const record = asRecord(item)
      return typeof record?.plain_text === 'string' ? record.plain_text : ''
    })
    .join('')
    .trim()
}

function numberOf(value: unknown) {
  const prop = asRecord(value)
  return typeof prop?.number === 'number' ? prop.number : null
}

function selectName(value: unknown) {
  const prop = asRecord(value)
  const select = asRecord(prop?.select)
  return typeof select?.name === 'string' ? select.name : ''
}

function dateStart(value: unknown) {
  const prop = asRecord(value)
  const date = asRecord(prop?.date)
  return typeof date?.start === 'string' ? date.start.slice(0, 10) : ''
}

function textItem(content: string) {
  return [{ type: 'text' as const, text: { content: content.slice(0, 2000) } }]
}

export function richTextProp(content: string) {
  return { rich_text: textItem(content) }
}

export function titleProp(content: string) {
  return { title: textItem(content) }
}

export function entryToProperties(entry: CollectionEntry) {
  const catalog = entry.catalog
  return {
    [NOTION_PROPS.name]: titleProp(catalog?.name || entry.id),
    [NOTION_PROPS.cardId]: richTextProp(entry.id),
    [NOTION_PROPS.set]: richTextProp(catalog?.setName || ''),
    [NOTION_PROPS.number]: richTextProp(catalog?.number || ''),
    [NOTION_PROPS.rarity]: richTextProp(catalog?.rarity || ''),
    [NOTION_PROPS.type]: richTextProp(catalog?.types?.[0] || ''),
    [NOTION_PROPS.quantity]: { number: entry.quantity },
    [NOTION_PROPS.condition]: { select: { name: entry.condition } },
    [NOTION_PROPS.notes]: richTextProp(entry.notes || ''),
    [NOTION_PROPS.added]: { date: { start: entry.added } },
  }
}

export function pageToEntry(page: NotionPageLike): CollectionEntry | null {
  const properties = page.properties ?? {}
  const id = richPlainText(properties[NOTION_PROPS.cardId])
  const quantity = numberOf(properties[NOTION_PROPS.quantity])
  const condition = selectName(properties[NOTION_PROPS.condition]) as Condition
  const added = dateStart(properties[NOTION_PROPS.added])
  if (!id || quantity == null || !CONDITIONS.includes(condition) || !added) return null

  const name = richPlainText(properties[NOTION_PROPS.name])
  const setName = richPlainText(properties[NOTION_PROPS.set])
  const number = richPlainText(properties[NOTION_PROPS.number])
  const rarity = richPlainText(properties[NOTION_PROPS.rarity])
  const type = richPlainText(properties[NOTION_PROPS.type])
  const catalog: CatalogSnapshot | undefined = name
    ? {
        name,
        number,
        rarity: rarity || undefined,
        types: type ? [type] : undefined,
        setName: setName || undefined,
      }
    : undefined

  return {
    id,
    quantity,
    condition,
    notes: richPlainText(properties[NOTION_PROPS.notes]),
    added,
    catalog,
  }
}

export function mergeEntry(current: CollectionEntry, incoming: CollectionEntry, quantity: number): CollectionEntry {
  return {
    ...current,
    quantity,
    condition: incoming.condition,
    printing: incoming.printing ?? current.printing,
    notes: incoming.notes ?? current.notes,
    catalog: incoming.catalog ?? current.catalog,
    added: current.added || incoming.added,
  }
}
