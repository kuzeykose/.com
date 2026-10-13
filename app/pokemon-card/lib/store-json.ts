import { readFileSync, writeFileSync } from 'fs'
import path from 'path'
import { CONDITIONS, type CollectionEntry, type CollectionFile } from './types.ts'
import type { CardStore } from './store.ts'

export const COLLECTION_PATH = path.join(process.cwd(), 'data/pokemon-card.json')

export function isJsonWritable() {
  return process.env.NODE_ENV === 'development'
}

export function readJsonCollection(): CollectionFile {
  const raw = readFileSync(COLLECTION_PATH, 'utf8')
  const parsed = JSON.parse(raw) as CollectionFile
  const cards = Array.isArray(parsed.cards) ? parsed.cards : []
  return { cards: cards.filter(isEntry) }
}

function isEntry(value: CollectionEntry): value is CollectionEntry {
  return (
    Boolean(value) &&
    typeof value.id === 'string' &&
    typeof value.quantity === 'number' &&
    CONDITIONS.includes(value.condition) &&
    typeof value.added === 'string'
  )
}

export function writeJsonCollection(file: CollectionFile) {
  writeFileSync(COLLECTION_PATH, `${JSON.stringify(file, null, 2)}\n`, 'utf8')
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function applyIncoming(current: CollectionEntry, incoming: CollectionEntry, quantity: number): CollectionEntry {
  return {
    ...current,
    quantity,
    condition: incoming.condition,
    printing: incoming.printing ?? current.printing,
    notes: incoming.notes ?? current.notes,
    catalog: incoming.catalog ?? current.catalog,
  }
}

export const jsonStore: CardStore = {
  kind: 'json',
  canWrite: isJsonWritable,
  async list() {
    return readJsonCollection().cards
  },
  async get(id) {
    return readJsonCollection().cards.find((card) => card.id === id) ?? null
  },
  async add(incoming) {
    const file = readJsonCollection()
    const index = file.cards.findIndex((card) => card.id === incoming.id)
    if (index === -1) {
      const created = { ...incoming, added: incoming.added || today() }
      file.cards.unshift(created)
      writeJsonCollection(file)
      return created
    }
    const current = file.cards[index]
    const next = applyIncoming(current, incoming, current.quantity + incoming.quantity)
    file.cards[index] = next
    writeJsonCollection(file)
    return next
  },
  async put(incoming) {
    const file = readJsonCollection()
    const index = file.cards.findIndex((card) => card.id === incoming.id)
    const entry = { ...incoming, added: incoming.added || today() }
    if (index === -1) {
      file.cards.unshift(entry)
      writeJsonCollection(file)
      return { entry, created: true }
    }
    file.cards[index] = { ...file.cards[index], ...entry }
    writeJsonCollection(file)
    return { entry: file.cards[index], created: false }
  },
  async update(id, patch) {
    const file = readJsonCollection()
    const index = file.cards.findIndex((card) => card.id === id)
    if (index === -1) return null
    const current = file.cards[index]
    const next: CollectionEntry = {
      ...current,
      quantity: patch.quantity ?? current.quantity,
      condition: patch.condition ?? current.condition,
      notes: patch.notes ?? current.notes,
      printing: patch.printing ?? current.printing,
      catalog: patch.catalog ?? current.catalog,
    }
    file.cards[index] = next
    writeJsonCollection(file)
    return next
  },
  async remove(id) {
    const file = readJsonCollection()
    const index = file.cards.findIndex((card) => card.id === id)
    if (index === -1) return false
    file.cards.splice(index, 1)
    writeJsonCollection(file)
    return true
  },
  async undo(id, quantity) {
    const file = readJsonCollection()
    const index = file.cards.findIndex((card) => card.id === id)
    if (index === -1) return null
    const current = file.cards[index]
    const nextQuantity = current.quantity - quantity
    if (nextQuantity <= 0) {
      file.cards.splice(index, 1)
      writeJsonCollection(file)
      return null
    }
    const next = { ...current, quantity: nextQuantity }
    file.cards[index] = next
    writeJsonCollection(file)
    return next
  },
}
