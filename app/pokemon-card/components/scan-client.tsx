'use client'

import dynamic from 'next/dynamic'

const ScanFlow = dynamic(() => import('./scan-flow').then((mod) => mod.ScanFlow), {
  ssr: false,
  loading: () => (
    <section>
      <h1 className="font-semibold text-2xl tracking-tighter">Scan a card</h1>
      <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-2 mb-6">
        Step 1 · Fit the card in the frame
      </p>
    </section>
  ),
})

export function ScanClient({ writable, mode }: { writable: boolean; mode?: string }) {
  return <ScanFlow writable={writable} mode={mode} />
}
