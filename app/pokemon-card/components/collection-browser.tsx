'use client'

import { useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { List, SquaresFour } from '@phosphor-icons/react'
import { CardTile, ListRow, SearchField, SelectPill, tileFromEntry } from './ui'
import { formatCopyCount, formatFilteredCount, formatMoney } from '../lib/format'
import { usdMarket } from '../lib/prices'
import type { EnrichedCard } from '../lib/types'

type SortKey = 'value' | 'value-asc' | 'name' | 'added' | 'set' | 'number'

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'value', label: 'Value ↓' },
  { value: 'value-asc', label: 'Value ↑' },
  { value: 'name', label: 'Name' },
  { value: 'added', label: 'Added' },
  { value: 'set', label: 'Set' },
  { value: 'number', label: 'Number' },
]

function param(searchParams: URLSearchParams, key: string) {
  return searchParams.get(key) ?? ''
}

function cardTypes(card: EnrichedCard) {
  return card.tcg?.types ?? []
}

export function CollectionBrowser({ cards }: { cards: EnrichedCard[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [typeOpen, setTypeOpen] = useState(false)

  const q = param(searchParams, 'q')
  const set = param(searchParams, 'set')
  const rarity = param(searchParams, 'rarity')
  const sort = (param(searchParams, 'sort') || 'value') as SortKey
  const layout = param(searchParams, 'layout') === 'list' ? 'list' : 'grid'
  const selectedTypes = searchParams.getAll('type')

  const sets = useMemo(() => {
    const map = new Map<string, string>()
    for (const card of cards) {
      if (card.tcg?.set.id) map.set(card.tcg.set.id, card.tcg.set.name)
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [cards])

  const types = useMemo(() => {
    const values = new Set<string>()
    for (const card of cards) {
      for (const type of cardTypes(card)) values.add(type)
    }
    return Array.from(values).sort()
  }, [cards])

  const rarities = useMemo(() => {
    const values = new Set<string>()
    for (const card of cards) {
      if (card.tcg?.rarity) values.add(card.tcg.rarity)
    }
    return Array.from(values).sort()
  }, [cards])

  function update(next: Record<string, string | string[] | null>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(next)) {
      params.delete(key)
      if (Array.isArray(value)) {
        for (const item of value) params.append(key, item)
      } else if (value) {
        params.set(key, value)
      }
    }
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    let next = cards.filter((card) => {
      const name = card.tcg?.name ?? card.id
      const setName = card.tcg?.set.name ?? ''
      const number = card.tcg?.number ?? ''
      if (query) {
        const hay = `${name} ${setName} ${number}`.toLowerCase()
        if (!hay.includes(query)) return false
      }
      if (set && card.tcg?.set.id !== set) return false
      if (rarity && card.tcg?.rarity !== rarity) return false
      if (selectedTypes.length && !cardTypes(card).some((type) => selectedTypes.includes(type))) {
        return false
      }
      return true
    })

    next = [...next].sort((a, b) => {
      const aValue = usdMarket(a.quote) ?? -1
      const bValue = usdMarket(b.quote) ?? -1
      if (sort === 'value') return bValue - aValue
      if (sort === 'value-asc') return aValue - bValue
      if (sort === 'name') return (a.tcg?.name ?? a.id).localeCompare(b.tcg?.name ?? b.id)
      if (sort === 'added') return b.added.localeCompare(a.added)
      if (sort === 'set') return (a.tcg?.set.name ?? '').localeCompare(b.tcg?.set.name ?? '')
      if (sort === 'number') {
        return Number.parseInt(a.tcg?.number ?? '0', 10) - Number.parseInt(b.tcg?.number ?? '0', 10)
      }
      return 0
    })
    return next
  }, [cards, q, set, rarity, selectedTypes, sort])

  const filteredOn = Boolean(q || set || rarity || selectedTypes.length)
  const typeLabel = selectedTypes.length ? selectedTypes.join(', ') : 'All'
  const unique = cards.length
  const copies = cards.reduce((sum, card) => sum + card.quantity, 0)
  const filteredUnique = filtered.length
  const filteredCopies = filtered.reduce((sum, card) => sum + card.quantity, 0)
  const countLabel = filteredOn
    ? formatFilteredCount(filteredUnique, unique, filteredCopies, copies)
    : formatCopyCount(copies, unique)

  return (
    <div>
      <SearchField
        value={q}
        onChange={(event) => update({ q: event.target.value || null })}
        placeholder="Search name, set or number"
      />

      <div className="flex flex-wrap items-center gap-2 mt-3 mb-2">
        <SelectPill
          label="Set"
          value={set}
          onChange={(value) => update({ set: value || null })}
          options={[{ value: '', label: 'All' }, ...sets.map(([id, name]) => ({ value: id, label: name }))]}
        />

        <div className="relative">
          <button
            type="button"
            onClick={() => setTypeOpen((open) => !open)}
            className="h-8 rounded-md border border-neutral-200 dark:border-neutral-800 px-2.5 text-sm inline-flex items-center gap-1.5 focus-visible:outline-none focus-visible:border-orange-600 focus-visible:ring-2 focus-visible:ring-orange-600"
          >
            <span className="text-neutral-600 dark:text-neutral-400">Type</span>
            <span>{typeLabel} ▾</span>
          </button>
          {typeOpen ? (
            <div className="absolute z-10 mt-1 min-w-[10rem] rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-2 shadow-sm">
              {types.map((type) => {
                const checked = selectedTypes.includes(type)
                return (
                  <label key={type} className="flex items-center gap-2 px-1 py-1 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        const next = checked
                          ? selectedTypes.filter((item) => item !== type)
                          : [...selectedTypes, type]
                        update({ type: next })
                      }}
                    />
                    {type}
                  </label>
                )
              })}
            </div>
          ) : null}
        </div>

        <SelectPill
          label="Rarity"
          value={rarity}
          onChange={(value) => update({ rarity: value || null })}
          options={[{ value: '', label: 'All' }, ...rarities.map((item) => ({ value: item, label: item }))]}
        />

        <span className="hidden sm:block flex-1" />

        <SelectPill
          label="Sort"
          value={sort}
          onChange={(value) => update({ sort: value })}
          options={SORT_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
        />

        <div className="hidden sm:flex items-center gap-2">
          <IconToggle
            label="Grid"
            pressed={layout === 'grid'}
            onClick={() => update({ layout: null })}
          >
            <SquaresFour size={16} weight="bold" />
          </IconToggle>
          <IconToggle
            label="List"
            pressed={layout === 'list'}
            onClick={() => update({ layout: 'list' })}
          >
            <List size={16} weight="bold" />
          </IconToggle>
        </div>
      </div>

      <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6">
        {countLabel}
        {filteredOn ? (
          <>
            {' · '}
            <button
              type="button"
              className="underline decoration-neutral-400 dark:decoration-neutral-600 underline-offset-2"
              onClick={() => update({ q: null, set: null, type: [], rarity: null, sort: null, layout: layout === 'list' ? 'list' : null })}
            >
              clear filters
            </button>
          </>
        ) : null}
      </p>

      {filtered.length === 0 ? (
        <p className="text-neutral-600 dark:text-neutral-400">No cards match those filters.</p>
      ) : layout === 'list' ? (
        <>
          <div className="hidden sm:block">
            {filtered.map((card) => (
              <Link key={card.id} href={`/pokemon-card/${card.id}`} className="block">
                <ListRow label={formatMoney(card.quote.market, card.quote.unit)}>
                  <span className="block">{card.tcg?.name ?? card.id}</span>
                  <span className="block text-neutral-600 dark:text-neutral-400 font-normal tracking-normal">
                    {card.tcg?.set.name ?? 'Unknown set'} · {card.tcg?.number ?? '—'}
                  </span>
                </ListRow>
              </Link>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:hidden">
            {filtered.map((card) => (
              <CardTile key={card.id} card={tileFromEntry(card)} href={`/pokemon-card/${card.id}`} />
            ))}
          </div>
        </>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-6">
          {filtered.map((card) => (
            <CardTile key={card.id} card={tileFromEntry(card)} href={`/pokemon-card/${card.id}`} />
          ))}
        </div>
      )}
    </div>
  )
}

function IconToggle({
  pressed,
  onClick,
  label,
  children,
}: {
  pressed: boolean
  onClick: () => void
  label: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={`w-8 h-8 rounded-full border inline-flex items-center justify-center ${
        pressed
          ? 'border-orange-600 text-neutral-900 dark:text-neutral-100'
          : 'border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400'
      } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600`}
    >
      {children}
    </button>
  )
}
