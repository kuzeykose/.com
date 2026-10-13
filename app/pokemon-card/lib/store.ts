import { isNotionConfigured } from './notion.ts'
import type { CatalogSnapshot, CollectionEntry, Condition } from './types.ts'
import { jsonStore } from './store-json.ts'
import { getNotionStore } from './store-notion.ts'

export { isNotionConfigured, notionDatabaseId, notionToken } from './notion.ts'

export type StoreKind = 'notion' | 'json'

export type CardPatch = {
  quantity?: number
  condition?: Condition
  notes?: string
  printing?: string
  catalog?: CatalogSnapshot
}

export interface CardStore {
  readonly kind: StoreKind
  canWrite(): boolean
  list(): Promise<CollectionEntry[]>
  get(id: string): Promise<CollectionEntry | null>
  add(entry: CollectionEntry): Promise<CollectionEntry>
  put(entry: CollectionEntry): Promise<{ entry: CollectionEntry; created: boolean }>
  update(id: string, patch: CardPatch): Promise<CollectionEntry | null>
  remove(id: string): Promise<boolean>
  undo(id: string, quantity: number): Promise<CollectionEntry | null>
}

export function getCardStore(): CardStore {
  if (isNotionConfigured()) return getNotionStore()
  return jsonStore
}

export function isWritable() {
  return getCardStore().canWrite()
}
