import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  BackLink,
  CardArt,
  ListRow,
  PageIntro,
  SourceCredit,
  TypeDot,
} from '../components/ui'
import { OwnerActions } from '../components/owner-actions'
import { getEnrichedCard, isWritable, readCollection } from '../lib/collection'
import { canShowOwnerTools } from '../lib/owner'
import { CONDITION_LABELS } from '../lib/constants'
import { formatLongDate, formatUpdated, formatUsd, printingLabel } from '../lib/format'

export const revalidate = 86400

export function generateStaticParams() {
  return readCollection().cards.map((card) => ({ id: card.id }))
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const card = await getEnrichedCard(id)
  const name = card?.tcg?.name ?? 'Pokémon card'
  return {
    title: name,
    description: card?.tcg
      ? `${card.tcg.set.name} · ${card.tcg.number}`
      : 'A card in the collection.',
  }
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const card = await getEnrichedCard(id)
  if (!card) notFound()

  const writable = isWritable()
  const owner = await canShowOwnerTools()
  const name = card.tcg?.name ?? card.id
  const setName = card.tcg?.set.name ?? 'Unknown set'
  const number = card.tcg?.number ?? '—'
  const printed = card.tcg?.set.printedTotal
  const rarity = card.tcg?.rarity
  const type = card.tcg?.types?.[0]
  const image = card.tcg?.images?.large ?? card.tcg?.images?.small
  const updated = formatUpdated(card.quote.updatedAt)

  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <BackLink />
        <OwnerActions owner={owner} />
      </div>
      <div className="mt-4">
        <PageIntro title={name}>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-2 mb-8">
            {setName} · {number}{printed ? `/${printed}` : ''}
            {rarity ? ` · ${rarity}` : ''}
          </p>
        </PageIntro>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[232px_1fr] gap-8">
        <div>
          <CardArt src={image} name={name} type={type} />
          <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-2">
            {card.tcg?.source === 'tcgdex'
              ? 'Image via TCGdex / TCGplayer (pokemontcg.io does not list this printing yet)'
              : 'Official image via images.pokemontcg.io'}
          </p>
        </div>
        <div className="pt-1">
          <ListRow label="Set">{setName}</ListRow>
          <ListRow label="Number">
            {`${number}${printed ? `/${printed}` : ''}`}
          </ListRow>
          <ListRow label="Rarity">{rarity ?? '—'}</ListRow>
          <ListRow label="Type">
            {type ? (
              <>
                <TypeDot type={type} />
                {type}
              </>
            ) : (
              'Trainer'
            )}
          </ListRow>
          <ListRow label="Condition">{CONDITION_LABELS[card.condition] ?? card.condition}</ListRow>
          <ListRow label="Quantity">{card.quantity}</ListRow>
          <ListRow label="Added">{formatLongDate(card.added)}</ListRow>
          {writable ? (
            <p className="text-sm mt-2">
              <Link
                href={`/pokemon-card/add?id=${encodeURIComponent(card.id)}`}
                className="underline decoration-neutral-400 dark:decoration-neutral-600 underline-offset-2 text-neutral-600 dark:text-neutral-400"
              >
                edit
              </Link>
            </p>
          ) : null}
        </div>
      </div>

      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4 mt-8">
        <div className="flex justify-between items-baseline gap-3">
          <span className="text-sm text-neutral-600 dark:text-neutral-400">Market value</span>
          <span className="text-sm">TCGplayer</span>
        </div>
        <div className="text-2xl font-semibold tracking-tight tabular-nums mt-1">
          {formatUsd(card.quote.market)}
        </div>
        <div className="flex justify-between gap-3 text-xs text-neutral-600 dark:text-neutral-400 mt-3">
          <span>
            TCGplayer · {printingLabel(card.quote.variant) ?? '—'} · Market price · USD · near mint
            {updated ? ` · updated ${updated}` : ''}
          </span>
        </div>
      </div>

      <h2 className="text-base font-medium mt-8 mb-2">Notes</h2>
      <p className="text-neutral-700 dark:text-neutral-300">
        {card.notes?.trim() ? card.notes : 'No notes yet.'}
      </p>

      <SourceCredit />
    </section>
  )
}
