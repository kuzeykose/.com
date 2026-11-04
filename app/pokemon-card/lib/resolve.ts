/**
 * Find a TCGdex card from what a collection app (Collectr) knows about it:
 * set name, card number, card name and the printed set total.
 * Shared by the Collectr importer and the pages, so a card imported while
 * TCGdex was unreachable still gets its image and type when the page renders.
 */
import { normalizeSetName } from './collectr.ts'
import { fetchSetCard, fetchSets, padLocalId, searchTcgdexCards } from './tcgdex.ts'
import type { TcgCard, TcgSet } from './types.ts'

export type CardHint = {
  name: string
  number: string
  setName: string
  printedTotal?: number
}

function simpleName(name: string) {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '')
}

export function sameCardName(a: string, b: string) {
  const x = simpleName(a)
  const y = simpleName(b)
  return x === y || x.startsWith(y) || y.startsWith(x)
}

export function matchSet(setName: string, printedTotal: number | undefined, sets: TcgSet[]) {
  const wanted = normalizeSetName(setName)
  const exact = sets.filter((set) => normalizeSetName(set.name) === wanted)
  if (exact.length === 1) return exact[0]
  // Same name in several series (e.g. "Base Set"): prefer the printed total match.
  const pool = exact.length
    ? exact
    : sets.filter((set) => {
        const name = normalizeSetName(set.name)
        return name.includes(wanted) || wanted.includes(name)
      })
  if (printedTotal) {
    const byTotal = pool.find((set) => set.printedTotal === printedTotal)
    if (byTotal) return byTotal
  }
  return pool[0] ?? null
}

export async function findCardInSet(hint: CardHint, setId: string | null) {
  if (setId) {
    const direct = await fetchSetCard(setId, hint.number)
    if (direct && sameCardName(direct.name, hint.name)) return direct
    const named = await searchTcgdexCards({ name: hint.name, set: setId }, 30)
    const byNumber = named.find((card) => padLocalId(card.number) === padLocalId(hint.number))
    if (byNumber) return byNumber
    if (direct) return direct
  }
  const anywhere = await searchTcgdexCards({ name: hint.name, localId: padLocalId(hint.number) }, 10)
  return anywhere.find((card) => sameCardName(card.name, hint.name)) ?? null
}

/** Resolve a card from its hint; null when TCGdex doesn't have it (yet). */
export async function resolveCard(hint: CardHint, sets?: TcgSet[]): Promise<TcgCard | null> {
  const list = sets ?? (await fetchSets())
  const set = matchSet(hint.setName, hint.printedTotal, list)
  if (!set && !list.length) return null
  return findCardInSet(hint, set?.id ?? null)
}
