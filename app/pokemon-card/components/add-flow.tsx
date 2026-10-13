'use client'

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Camera, UploadSimple } from '@phosphor-icons/react'
import {
  BackLink,
  CardArt,
  CardTile,
  GhostButton,
  OptionPill,
  PageIntro,
  PrimaryButton,
  PrivateBadge,
  SearchField,
  SelectPill,
  SourceCredit,
} from './ui'
import { CONDITIONS } from '../lib/types'
import { formatMoney, formatShortDate, priceCaption, printingLabel } from '../lib/format'
import type { EnrichedCard, SearchCard, TcgSet } from '../lib/types'

type RecentSearch = { q: string; at: string }

const RECENT_KEY = 'pokemon-card-recent-searches'
const RECENT_EVENT = 'pokemon-card-recent'
const EMPTY_RECENT: RecentSearch[] = []
let recentCache: RecentSearch[] = EMPTY_RECENT
let recentCacheRaw: string | null = null

function loadRecent(): RecentSearch[] {
  if (typeof window === 'undefined') return EMPTY_RECENT
  try {
    const raw = window.localStorage.getItem(RECENT_KEY)
    if (raw === recentCacheRaw) return recentCache
    recentCacheRaw = raw
    recentCache = raw ? (JSON.parse(raw) as RecentSearch[]) : EMPTY_RECENT
    return recentCache
  } catch {
    return EMPTY_RECENT
  }
}

function saveRecent(q: string) {
  const next = [{ q, at: new Date().toISOString() }, ...loadRecent().filter((item) => item.q !== q)].slice(0, 8)
  window.localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  window.dispatchEvent(new Event(RECENT_EVENT))
}

function useRecentSearches() {
  return useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener(RECENT_EVENT, onStoreChange)
      window.addEventListener('storage', onStoreChange)
      return () => {
        window.removeEventListener(RECENT_EVENT, onStoreChange)
        window.removeEventListener('storage', onStoreChange)
      }
    },
    loadRecent,
    () => EMPTY_RECENT
  )
}

export function AddFlow({
  writable,
  editing,
  initialQuery,
}: {
  writable: boolean
  editing: EnrichedCard | null
  initialQuery?: string
}) {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2 | 3>(editing ? 3 : 1)
  const [query, setQuery] = useState(editing?.tcg?.name ?? initialQuery ?? '')
  const [setId, setSetId] = useState('')
  const [sets, setSets] = useState<TcgSet[]>([])
  const [results, setResults] = useState<SearchCard[]>([])
  const [selected, setSelected] = useState<SearchCard | null>(
    editing?.tcg
      ? {
          id: editing.tcg.id,
          name: editing.tcg.name,
          number: editing.tcg.number,
          rarity: editing.tcg.rarity,
          types: editing.tcg.types,
          setName: editing.tcg.set.name,
          setId: editing.tcg.set.id,
          printedTotal: editing.tcg.set.printedTotal,
          image: editing.tcg.images?.large ?? editing.tcg.images?.small,
          printings: editing.tcg.tcgplayer?.prices
            ? Object.keys(editing.tcg.tcgplayer.prices)
            : editing.tcg.cardmarket?.avg != null
              ? ['cardmarket']
              : [],
          quotes: {
            ...Object.fromEntries(
              Object.entries(editing.tcg.tcgplayer?.prices ?? {})
                .filter(([, value]) => value?.market != null)
                .map(([key, value]) => [key, value!.market as number])
            ),
            ...(editing.tcg.tcgplayer?.prices || editing.tcg.cardmarket?.avg == null
              ? {}
              : { cardmarket: editing.tcg.cardmarket.avg }),
          },
          quoteUnit: editing.tcg.tcgplayer?.prices ? 'USD' : editing.tcg.cardmarket?.avg != null ? 'EUR' : undefined,
          updatedAt: editing.tcg.tcgplayer?.updatedAt ?? editing.tcg.cardmarket?.updatedAt ?? null,
        }
      : null
  )
  const [printing, setPrinting] = useState(editing?.printing ?? editing?.quote.variant ?? '')
  const [condition, setCondition] = useState(editing?.condition ?? 'NM')
  const [quantity, setQuantity] = useState(editing?.quantity ?? 1)
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const recent = useRecentSearches()
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!editing && initialQuery?.trim()) {
      runSearch(initialQuery)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/pokemon-card/sets')
      .then((res) => (res.ok ? res.json() : { sets: [] }))
      .then((body) => {
        if (!cancelled) setSets(body.sets ?? [])
      })
      .catch(() => {
        if (!cancelled) setSets([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const printings = selected?.printings?.length ? selected.printings : ['holofoil', 'reverseHolofoil', 'normal']
  const activePrinting = printing && printings.includes(printing) ? printing : printings[0]
  const market = selected?.quotes[activePrinting] ?? null

  async function runSearch(nextQuery = query, nextSet = setId) {
    const q = nextQuery.trim()
    if (!q) return
    setBusy(true)
    setError(null)
    try {
      const params = new URLSearchParams({ q })
      if (nextSet) params.set('set', nextSet)
      const res = await fetch(`/api/pokemon-card/search?${params}`)
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Search failed')
      const cards = (body.cards ?? []) as SearchCard[]
      setResults(cards)
      setSelected(cards[0] ?? null)
      setPrinting(cards[0]?.printings[0] ?? '')
      setStep(2)
      saveRecent(q)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    if (!writable || !selected || saving) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/pokemon-card/collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selected.id,
          quantity,
          condition,
          printing: activePrinting,
          notes,
          mode: editing ? 'edit' : 'add',
          catalog: {
            name: selected.name,
            number: selected.number,
            rarity: selected.rarity,
            types: selected.types,
            setId: selected.setId,
            setName: selected.setName,
            printedTotal: selected.printedTotal,
            image: selected.image,
            market: selected.quotes[activePrinting],
            currency: selected.quoteUnit,
            variant: activePrinting,
            updatedAt: selected.updatedAt ?? undefined,
          },
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Could not save')
      router.push(`/pokemon-card/${selected.id}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  const stepLabel = useMemo(() => {
    if (step === 1) return 'Step 1 of 3 · Search'
    if (step === 2) return 'Step 2 of 3 · Pick a printing'
    return 'Step 3 of 3 · Details'
  }, [step])

  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <BackLink />
        <PrivateBadge />
      </div>
      <div className="mt-4">
        <PageIntro title={editing ? 'Edit a card' : 'Add a card'}>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-2 mb-6">
            {step === 1 && !editing
              ? 'Scan it, upload a photo, or search by hand.'
              : stepLabel}
          </p>
        </PageIntro>
      </div>

      {!writable ? (
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6">
          Saving only works in local development (`pnpm dev`), or when Notion is configured.
        </p>
      ) : null}

      {step === 1 ? (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            runSearch()
          }}
        >
          <div className="grid gap-3 mb-6">
            <Link
              href="/pokemon-card/scan"
              className="rounded-lg border border-orange-600 px-4 py-4 block"
            >
              <div className="flex items-start gap-3">
                <Camera className="mt-0.5 shrink-0" />
                <div>
                  <div className="text-sm font-medium">Scan card</div>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                    Use your camera. Reads the name and set number.
                  </p>
                </div>
              </div>
            </Link>
            <Link
              href="/pokemon-card/scan?mode=upload"
              className="rounded-lg border border-neutral-200 dark:border-neutral-800 px-4 py-4 block"
            >
              <div className="flex items-start gap-3">
                <UploadSimple className="mt-0.5 shrink-0" />
                <div>
                  <div className="text-sm font-medium">Upload photo</div>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                    Pick an existing photo of the card front.
                  </p>
                </div>
              </div>
            </Link>
          </div>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">or search by hand</p>
          <SearchField
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder='Name, set or number — e.g. “Pikachu 58”'
          />
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <SelectPill
              label="Set"
              value={setId}
              onChange={setSetId}
              options={[{ value: '', label: 'Any' }, ...sets.map((item) => ({ value: item.id, label: item.name }))]}
              selectClassName="max-w-[12rem]"
            />
            <span className="text-xs text-neutral-600 dark:text-neutral-400">
              Searches TCGdex (api.tcgdex.net)
            </span>
            <PrimaryButton type="submit" disabled={busy || !query.trim()} className="ml-auto">
              {busy ? 'Searching…' : 'Search'}
            </PrimaryButton>
          </div>
          <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-4">
            Photos are only used to read the card and aren&apos;t saved.
          </p>
        </form>
      ) : null}

      {step === 2 ? (
        <>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              runSearch()
            }}
          >
            <SearchField
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </form>
          <div className="flex items-center justify-between gap-3 my-3 mb-6">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              {results.length} printings
              {selected ? (
                <>
                  {' · selected '}
                  <span className="text-neutral-900 dark:text-neutral-100">
                    {selected.setName} {selected.number}
                    {selected.printedTotal ? `/${selected.printedTotal}` : ''}
                    {selected.rarity ? ` · ${selected.rarity}` : ''}
                  </span>
                </>
              ) : null}
            </p>
            <PrimaryButton type="button" disabled={!selected} onClick={() => setStep(3)}>
              Continue
            </PrimaryButton>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-6">
            {results.map((card) => (
              <CardTile
                key={card.id}
                selected={selected?.id === card.id}
                onSelect={() => {
                  setSelected(card)
                  setPrinting(card.printings[0] ?? '')
                }}
                card={{
                  id: card.id,
                  name: card.setName,
                  image: card.image,
                  type: card.types?.[0],
                  line: `${card.number}${card.printedTotal ? `/${card.printedTotal}` : ''}`,
                }}
                meta={
                  <div className="flex justify-between gap-2 text-xs text-neutral-600 dark:text-neutral-400">
                    <span>
                      {card.number}
                      {card.printedTotal ? `/${card.printedTotal}` : ''}
                    </span>
                    <span>{card.rarity ?? ''}</span>
                  </div>
                }
              />
            ))}
          </div>
        </>
      ) : null}

      {step === 3 && selected ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-8">
            <div>
              <CardArt src={selected.image} name={selected.name} type={selected.types?.[0]} />
              <p className="text-sm mt-2">{selected.name}</p>
              <p className="text-xs text-neutral-600 dark:text-neutral-400">
                {selected.setName} · {selected.number}
                {selected.printedTotal ? `/${selected.printedTotal}` : ''}
                {selected.rarity ? ` · ${selected.rarity}` : ''}
              </p>
            </div>
            <div>
              <Field label="Printing">
                <div className="flex flex-wrap gap-1.5">
                  {printings.map((key) => (
                    <OptionPill key={key} selected={activePrinting === key} onClick={() => setPrinting(key)}>
                      {printingLabel(key)}
                    </OptionPill>
                  ))}
                </div>
              </Field>
              <Field label="Condition">
                <div className="flex flex-wrap gap-1.5">
                  {CONDITIONS.map((item) => (
                    <OptionPill key={item} selected={condition === item} onClick={() => setCondition(item)}>
                      {item}
                    </OptionPill>
                  ))}
                </div>
              </Field>
              <Field label="Quantity">
                <div className="flex flex-wrap gap-1.5 items-center">
                  <OptionPill onClick={() => setQuantity((n) => Math.max(1, n - 1))}>−</OptionPill>
                  <span className="px-2 text-sm tabular-nums">{quantity}</span>
                  <OptionPill onClick={() => setQuantity((n) => Math.min(99, n + 1))}>+</OptionPill>
                </div>
              </Field>
              <Field label="Notes">
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Where it came from, grading plans…"
                  rows={3}
                  className="w-full rounded-lg border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-sm bg-transparent outline-none focus:border-orange-600"
                />
              </Field>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-800">
            <div className="tabular-nums">
              {formatMoney(market, selected.quoteUnit)}{' '}
              <span className="text-xs text-neutral-600 dark:text-neutral-400">
                {priceCaption(market == null ? null : selected.quoteUnit, activePrinting)}
              </span>
            </div>
            <div className="flex gap-2">
              <GhostButton type="button" onClick={() => setStep(editing ? 1 : 2)}>
                Back
              </GhostButton>
              <PrimaryButton type="button" disabled={!writable || saving} onClick={save}>
                {saving ? 'Saving…' : editing ? 'Save changes' : 'Add to collection'}
              </PrimaryButton>
            </div>
          </div>
          {!writable ? (
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-3">
              Saving only works in local development (`pnpm dev`), or when Notion is configured.
            </p>
          ) : null}
        </>
      ) : null}

      {error ? <p className="text-sm text-orange-600 mt-4">{error}</p> : null}

      {step === 1 ? (
        <>
          <hr className="my-8 border-neutral-200 dark:border-neutral-800" />
          <h2 className="text-base font-medium mb-3">Recent searches</h2>
          {recent.length === 0 ? (
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Searches stay in this browser.
            </p>
          ) : (
            <div>
              {recent.map((item) => (
                <button
                  key={`${item.q}-${item.at}`}
                  type="button"
                  className="flex gap-2 mb-3 text-sm w-full text-left"
                  onClick={() => {
                    setQuery(item.q)
                    runSearch(item.q, setId)
                  }}
                >
                  <span className="w-[100px] shrink-0 text-neutral-600 dark:text-neutral-400 tabular-nums">
                    {formatShortDate(item.at.slice(0, 10))}
                  </span>
                  <span className="tracking-tight">{item.q}</span>
                </button>
              ))}
            </div>
          )}
        </>
      ) : null}

      <SourceCredit />
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-1.5">{label}</div>
      {children}
    </div>
  )
}
