import Link from 'next/link'
import {
  CardArt,
  CardTile,
  ListRow,
  PageIntro,
  SectionTabs,
  SectionTitle,
  SourceCredit,
  TypeDot,
  tileFromEntry,
} from './components/ui'
import { collectionTotals, getEnrichedCollection } from './lib/collection'
import { canShowOwnerTools } from './lib/owner'
import { formatCount, formatShortDate } from './lib/format'
import { TYPE_COLORS, rarityRank } from './lib/constants'
import type { EnrichedCard } from './lib/types'

export const revalidate = 300

export const metadata = {
  title: 'Pokémon cards',
  description: 'A small record of what’s in my binders.',
}

export default async function Page() {
  const cards = await getEnrichedCollection()
  const totals = collectionTotals(cards)
  const owner = await canShowOwnerTools()

  const showcase = [...cards]
    .sort(
      (a, b) =>
        rarityRank(b.tcg?.rarity) - rarityRank(a.tcg?.rarity) || b.added.localeCompare(a.added)
    )
    .slice(0, 5)
  const recent = [...cards].sort((a, b) => b.added.localeCompare(a.added)).slice(0, 4)
  const sets = setProgress(cards)
  const byType = aggregate(cards, (card) => card.tcg?.types?.[0] ?? 'Trainer')
  const typeTotal = byType.reduce((sum, item) => sum + item.value, 0) || 1
  const byRarity = aggregate(cards, (card) => card.tcg?.rarity ?? 'Unknown').sort(
    (a, b) => rarityRank(b.key) - rarityRank(a.key)
  )

  return (
    <section>
      <PageIntro>
        <p className="text-neutral-600 dark:text-neutral-400 mt-2">
          A small record of what&apos;s in my binders.
        </p>
      </PageIntro>
      <SectionTabs active="overview" owner={owner} />

      {showcase.length ? <Fan cards={showcase} /> : null}

      <dl className="grid grid-cols-4 gap-4 mt-10">
        <Stat label="cards" value={formatCount(totals.copies)} />
        <Stat label="unique" value={formatCount(totals.unique)} />
        <Stat label="sets" value={formatCount(totals.sets)} />
        <Stat label="types" value={formatCount(byType.length)} />
      </dl>

      <hr className="my-8 border-neutral-200 dark:border-neutral-800" />

      <SectionTitle>Sets</SectionTitle>
      <div className="mb-2">
        {sets.map((item) => (
          <Link
            key={item.id || item.name}
            href={item.id ? `/pokemon-card/collection?set=${encodeURIComponent(item.id)}` : '/pokemon-card/collection'}
            className="group block mb-4 text-sm"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-neutral-900 dark:text-neutral-100 tracking-tight group-hover:underline underline-offset-2 decoration-neutral-400 dark:decoration-neutral-600">
                {item.name}
              </span>
              <span className="shrink-0 text-neutral-600 dark:text-neutral-400 tabular-nums">
                {item.total ? `${item.owned} of ${item.total}` : `${item.owned} cards`}
              </span>
            </div>
            <div className="h-1 rounded-sm bg-neutral-200 dark:bg-neutral-800 mt-1.5">
              <span
                className="block h-full rounded-sm bg-neutral-600 dark:bg-neutral-400"
                style={{
                  width: `${item.total ? Math.min(100, Math.max(2, (item.owned / item.total) * 100)) : 100}%`,
                }}
              />
            </div>
          </Link>
        ))}
      </div>

      <hr className="my-8 border-neutral-200 dark:border-neutral-800" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
        <div>
          <SectionTitle>Types</SectionTitle>
          <div className="flex h-2 rounded-sm overflow-hidden gap-px mb-4" aria-hidden>
            {byType.map((item) => (
              <span
                key={item.key}
                style={{
                  width: `${(item.value / typeTotal) * 100}%`,
                  backgroundColor: TYPE_COLORS[item.key] ?? '#A3A3A3',
                }}
              />
            ))}
          </div>
          {byType.map((item) => (
            <ListRow
              key={item.key}
              label={
                <span>
                  <TypeDot type={TYPE_COLORS[item.key] ? item.key : undefined} />
                  {item.key}
                </span>
              }
            >
              <span className="text-neutral-600 dark:text-neutral-400 tabular-nums">
                {formatCount(item.value)} · {Math.round((item.value / typeTotal) * 100)}%
              </span>
            </ListRow>
          ))}
        </div>
        <div>
          <SectionTitle>Rarity</SectionTitle>
          {byRarity.map((item) => (
            <ListRow key={item.key} label={formatCount(item.value)}>
              <Link
                href={`/pokemon-card/collection?rarity=${encodeURIComponent(item.key)}`}
                className="hover:underline underline-offset-2 decoration-neutral-400 dark:decoration-neutral-600"
              >
                {item.key}
              </Link>
            </ListRow>
          ))}
        </div>
      </div>

      <hr className="my-8 border-neutral-200 dark:border-neutral-800" />

      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h2 className="text-base font-medium">Recently added</h2>
        <Link
          href="/pokemon-card/collection?sort=added"
          className="text-sm text-neutral-600 dark:text-neutral-400 underline decoration-neutral-400 dark:decoration-neutral-600 underline-offset-2"
        >
          see all
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-6">
        {recent.map((card) => (
          <CardTile
            key={card.id}
            href={`/pokemon-card/${card.id}`}
            card={tileFromEntry(card)}
            meta={
              <div className="text-xs text-neutral-600 dark:text-neutral-400">
                Added {formatShortDate(card.added)}
              </div>
            }
          />
        ))}
      </div>

      <SourceCredit />
    </section>
  )
}

/** The rarest cards, fanned out like a hand. */
function Fan({ cards }: { cards: EnrichedCard[] }) {
  const mid = (cards.length - 1) / 2
  return (
    <div>
      <div className="relative flex justify-center pt-4 pb-2" aria-label="Highlights">
        {cards.map((card, index) => {
          const offset = index - mid
          const name = card.tcg?.name ?? card.id
          return (
            <Link
              key={card.id}
              href={`/pokemon-card/${card.id}`}
              title={name}
              className="relative block w-[21%] max-w-[140px] -mx-[1.5%] first:ml-0 last:mr-0 rounded-md transition-transform duration-200 ease-out hover:z-10 hover:!-translate-y-3 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600"
              style={{
                transform: `translateY(${Math.abs(offset) * 10}px) rotate(${offset * 6}deg)`,
                zIndex: cards.length - Math.round(Math.abs(offset) * 2),
              }}
            >
              <div className="shadow-[0_6px_20px_-8px_rgba(0,0,0,0.35)] rounded-[4.5%/3.2%]">
                <CardArt
                  src={card.tcg?.images?.small}
                  name={name}
                  type={card.tcg?.types?.[0]}
                  label={`${card.tcg?.set.name ?? ''} · ${card.tcg?.number ?? ''}`}
                />
              </div>
            </Link>
          )
        })}
      </div>
      <p className="mt-6 text-center text-xs text-neutral-600 dark:text-neutral-400">
        The rarest pulls in the binders
      </p>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dd className="text-xl font-semibold tracking-tight tabular-nums">{value}</dd>
      <dt className="text-sm text-neutral-600 dark:text-neutral-400">{label}</dt>
    </div>
  )
}

function setProgress(cards: EnrichedCard[]) {
  const map = new Map<string, { id: string; name: string; total?: number; numbers: Set<string> }>()
  for (const card of cards) {
    const id = card.tcg?.set.id ?? ''
    const key = id || card.tcg?.set.name || 'Unknown set'
    const entry = map.get(key) ?? {
      id,
      name: card.tcg?.set.name ?? 'Unknown set',
      total: card.tcg?.set.printedTotal,
      numbers: new Set<string>(),
    }
    entry.numbers.add(card.tcg?.number ?? card.id)
    entry.total ??= card.tcg?.set.printedTotal
    map.set(key, entry)
  }
  return Array.from(map.values())
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      total: entry.total,
      owned: entry.numbers.size,
    }))
    .sort((a, b) => b.owned - a.owned || a.name.localeCompare(b.name))
}

function aggregate(cards: EnrichedCard[], keyOf: (card: EnrichedCard) => string) {
  const map = new Map<string, number>()
  for (const card of cards) {
    const key = keyOf(card)
    map.set(key, (map.get(key) ?? 0) + card.quantity)
  }
  return Array.from(map.entries())
    .map(([key, value]) => ({ key, value }))
    .sort((a, b) => b.value - a.value)
}
