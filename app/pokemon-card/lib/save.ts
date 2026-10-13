import { isWritable, upsertCard } from './collection'
import { CONDITIONS, type CatalogSnapshot, type CollectionEntry, type Condition } from './types'

export type SaveMode = 'add' | 'edit' | 'undo'

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
 * Small write port so a database-backed saver can replace the JSON file later.
 * Local development writes `data/pokemon-card.json`. Production stays read-only.
 */
export interface CardSaver {
  canWrite(): boolean
  save(input: CardSaveInput): CardSaveResult
}

function validate(input: CardSaveInput): CardSaveResult | null {
  const id = input.id.trim()
  if (!id || !Number.isFinite(input.quantity) || input.quantity < 1 || input.quantity > 99) {
    return { ok: false, error: 'id and quantity (1–99) are required' }
  }
  if (!CONDITIONS.includes(input.condition)) {
    return { ok: false, error: 'Invalid condition' }
  }
  return null
}

export const localJsonSaver: CardSaver = {
  canWrite: isWritable,
  save(input) {
    if (!this.canWrite()) {
      return {
        ok: false,
        error: 'Collection writes only work in local development (pnpm dev).',
      }
    }
    const invalid = validate(input)
    if (invalid) return invalid

    const entry: CollectionEntry = {
      id: input.id.trim(),
      quantity: input.quantity,
      condition: input.condition,
      printing: input.printing,
      notes: input.notes ?? '',
      added: new Date().toISOString().slice(0, 10),
      catalog: input.catalog?.name ? input.catalog : undefined,
    }
    upsertCard(entry, input.mode ?? 'add')
    return { ok: true }
  },
}

export function getCardSaver(): CardSaver {
  return localJsonSaver
}
