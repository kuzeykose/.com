import { AddFlow } from '../components/add-flow'
import { getEnrichedCard, isWritable } from '../lib/collection'
import { gateOwnerPage } from '../lib/owner'

export const metadata = {
  title: 'Add a Pokémon card',
  description: 'Search TCGdex and add a card to the local collection file.',
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; q?: string }>
}) {
  const { id, q } = await searchParams
  const next = id
    ? `/pokemon-card/add?id=${encodeURIComponent(id)}`
    : q
      ? `/pokemon-card/add?q=${encodeURIComponent(q)}`
      : '/pokemon-card/add'
  await gateOwnerPage(next)
  const writable = isWritable()
  const editing = typeof id === 'string' && id ? await getEnrichedCard(id) : null

  return <AddFlow writable={writable} editing={editing} initialQuery={q} />
}
