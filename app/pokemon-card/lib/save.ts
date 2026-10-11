import 'server-only'

import { revalidateCollection } from './collection'
import { getCardStore, type CardStore } from './store'
import { CONDITIONS, type CatalogSnapshot, type CollectionEntry, type Condition } from './types'

export type SaveMode = 'add' | 'edit' | 'undo' | 'remove'

export type CardSaveInput = {
  id: string
  quantity: number
  condition: Condition
  printing?: string
  notes?: string
  catalog?: CatalogSnapshot
  mode?: SaveMode
}

export type CardSaveResult = { ok: true } | { ok: false; error: string }

/**
 * Write port over the collection store (Notion when configured, JSON otherwise).
 */
export interface CardSaver {
  canWrite(): boolean
  save(input: CardSaveInput): Promise<CardSaveResult>
}

function validate(input: CardSaveInput): CardSaveResult | null {
  const id = input.id.trim()
  if (!id) return { ok: false, error: 'id and quantity (1–99) are required' }
  if (input.mode !== 'remove' && input.mode !== 'undo') {
    if (!Number.isFinite(input.quantity) || input.quantity < 1 || input.quantity > 99) {
      return { ok: false, error: 'id and quantity (1–99) are required' }
    }
  }
  if (input.mode !== 'remove' && !CONDITIONS.includes(input.condition)) {
    return { ok: false, error: 'Invalid condition' }
  }
  return null
}

function writeError(store: CardStore) {
  if (store.kind === 'json') {
    return 'Collection writes only work in local development (pnpm dev), or when Notion is configured.'
  }
  return 'Collection is not writable.'
}

export function createStoreSaver(store: CardStore): CardSaver {
  return {
    canWrite: () => store.canWrite(),
    async save(input) {
      if (!this.canWrite()) {
        return { ok: false, error: writeError(store) }
      }
      const invalid = validate(input)
      if (invalid) return invalid

      const id = input.id.trim()
      const entry: CollectionEntry = {
        id,
        quantity: input.quantity,
        condition: input.condition,
        printing: input.printing,
        notes: input.notes ?? '',
        added: new Date().toISOString().slice(0, 10),
        catalog: input.catalog?.name ? input.catalog : undefined,
      }

      try {
        if (input.mode === 'remove') {
          const removed = await store.remove(id)
          if (!removed) return { ok: false, error: 'Card not found' }
        } else if (input.mode === 'undo') {
          await store.undo(id, input.quantity)
        } else if (input.mode === 'edit') {
          const updated = await store.update(id, {
            quantity: entry.quantity,
            condition: entry.condition,
            notes: entry.notes,
            printing: entry.printing,
            catalog: entry.catalog,
          })
          if (!updated) {
            await store.add(entry)
          }
        } else {
          await store.add(entry)
        }
        revalidateCollection(id)
        return { ok: true }
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : 'Could not save',
        }
      }
    },
  }
}

export function getCardSaver(): CardSaver {
  return createStoreSaver(getCardStore())
}
