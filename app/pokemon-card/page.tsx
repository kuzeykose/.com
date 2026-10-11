import Link from 'next/link'
import {
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
import { formatCopyCount, formatCount, formatMoney, formatShortDate, formatUsd } from './lib/format'
import { TYPE_COLORS } from './lib/constants'
import { usdMarket } from './lib/prices'
import type { EnrichedCard } from './lib/types'

export const revalidate = 300

export const metadata = {
  title: 'Pokémon cards',
  description: 'A small record of what’s in my binders. Prices are estimates.',
}

export default async function Page() {
  const cards = await getEnrichedCollection()
  const totals = collectionTotals(cards)
  const owner = await canShowOwnerTools()

  const bySet = aggregate(
    cards,
    (card) => card.tcg?.set.name ?? 'Unknown set',
    (card) => (usdMarket(card.quote) ?? 0) * card.quantity
  )
  const byType = aggregate(
    cards,
    (card) => card.tcg?.types?.[0] ?? 'Trainer',
    (card) => card.quantity
  )
  const byRarity = aggregate(
    cards,
    (card) => card.tcg?.rarity ?? 'Unknown',
    (card) => card.quantity
  )
  const typeTotal = byType.reduce((sum, item) => sum + item.value, 0) || 1
  const mostValuable = [...cards]
    .sort((a, b) => (usdMarket(b.quote) ?? 0) * b.quantity - (usdMarket(a.quote) ?? 0) * a.quantity)
    .slice(0, 5)
  const recent = [...cards].sort((a, b) => b.added.localeCompare(a.added)).slice(0, 4)
  const maxSet = Math.max(...bySet.map((item) => item.value), 1)

  return (
    <section>
      <PageIntro>
        <p className="text-neutral-600 dark:text-neutral-400 mt-2">
          A small record of what&apos;s in my binders. Prices are estimates.
        </p>
      </PageIntro>
      <SectionTabs active="overview" owner={owner} />

      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
        <div className="grid grid-cols-3 gap-4">
          <Stat
            label="cards"
            value={formatCount(totals.copies)}
            hint={formatCopyCount(totals.copies, totals.unique)}
          />
          <Stat label="Est. value" value={formatUsd(totals.value)} hint="near mint · USD" />
          <Stat label="Sets" value={formatCount(totals.sets)} hint="in the binders" />
        </div>
      </div>

      <hr className="my-8 border-neutral-200 dark:border-neutral-800" />

      <SectionTitle>By set</SectionTitle>
      <div className="mb-2">
        {bySet.map((item) => (
          <div key={item.key} className="flex gap-2 mb-3 text-sm">
            <div className="w-[100px] shrink-0 text-neutral-600 dark:text-neutral-400 tabular-nums">
              {formatUsd(item.value)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-neutral-900 dark:text-neutral-100 tracking-tight">{item.key}</div>
              <div className="h-1 rounded-sm bg-neutral-200 dark:bg-neutral-800 mt-1">
                <span
                  className="block h-full rounded-sm bg-neutral-600 dark:bg-neutral-400"
                  style={{ width: `${Math.max(6, (item.value / maxSet) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mt-8">
        <div>
          <SectionTitle>By type</SectionTitle>
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
              {Math.round((item.value / typeTotal) * 100)}%
            </ListRow>
          ))}
        </div>
        <div>
          <SectionTitle>By rarity</SectionTitle>
          {byRarity.map((item) => (
            <ListRow key={item.key} label={formatCount(item.value)}>
              {item.key}
            </ListRow>
          ))}
        </div>
      </div>

      <hr className="my-8 border-neutral-200 dark:border-neutral-800" />

      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h2 className="text-base font-medium">Most valuable</h2>
        <Link
          href="/pokemon-card/collection?sort=value"
          className="text-sm text-neutral-600 dark:text-neutral-400 underline decoration-neutral-400 dark:decoration-neutral-600 underline-offset-2"
        >
          see all
        </Link>
      </div>
      {mostValuable.map((card) => (
        <Link key={card.id} href={`/pokemon-card/${card.id}`} className="block">
          <ListRow label={formatMoney(card.quote.market, card.quote.unit)}>
            {card.tcg?.name ?? card.id}
            <span className="text-neutral-600 dark:text-neutral-400">
              {' '}
              · {card.tcg?.set.name ?? 'Unknown set'} {card.tcg?.number ?? ''}
              {card.tcg?.set.printedTotal ? `/${card.tcg.set.printedTotal}` : ''}
            </span>
          </ListRow>
        </Link>
      ))}

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
        {recent.map((card) => {
          const tile = tileFromEntry(card)
          return (
            <CardTile
              key={card.id}
              href={`/pokemon-card/${card.id}`}
              card={tile}
              meta={
                <div className="text-xs text-neutral-600 dark:text-neutral-400">
                  Added {formatShortDate(card.added)}
                </div>
              }
            />
          )
        })}
      </div>

      <SourceCredit />
    </section>
  )
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint: string
}) {
  return (
    <div>
      <div className="text-sm text-neutral-600 dark:text-neutral-400">{label}</div>
      <div className="text-xl font-semibold tracking-tight tabular-nums">{value}</div>
      <div className="text-xs text-neutral-600 dark:text-neutral-400">{hint}</div>
    </div>
  )
}

function aggregate(
  cards: EnrichedCard[],
  keyOf: (card: EnrichedCard) => string,
  valueOf: (card: EnrichedCard) => number
) {
  const map = new Map<string, number>()
  for (const card of cards) {
    const key = keyOf(card)
    map.set(key, (map.get(key) ?? 0) + valueOf(card))
  }
  return Array.from(map.entries())
    .map(([key, value]) => ({ key, value }))
    .sort((a, b) => b.value - a.value)
}
