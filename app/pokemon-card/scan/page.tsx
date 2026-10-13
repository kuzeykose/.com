import { ScanClient } from '../components/scan-client'
import { isWritable } from '../lib/collection'
import { gateOwnerPage } from '../lib/owner'

export const metadata = {
  title: 'Scan a Pokémon card',
  description: 'Scan or upload a card photo. The image is read in the browser and then discarded.',
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>
}) {
  const { mode } = await searchParams
  await gateOwnerPage(mode ? `/pokemon-card/scan?mode=${encodeURIComponent(mode)}` : '/pokemon-card/scan')
  return <ScanClient writable={isWritable()} mode={mode} />
}
