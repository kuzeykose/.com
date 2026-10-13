import { notFound, redirect } from 'next/navigation'
import { BackLink, PageIntro, PrimaryButton, nativeFieldClass } from '../components/ui'
import { hasOwnerCookie, isDevOpen, ownerPassword, safeNext } from '../lib/owner'
import { unlockOwner } from './actions'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Owner access',
  description: 'Unlock add and scan for the Pokémon card collection.',
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>
}) {
  const { next: rawNext, error } = await searchParams
  const next = safeNext(rawNext)

  if (isDevOpen()) redirect(next)
  if (!ownerPassword()) notFound()
  if (await hasOwnerCookie()) redirect(next)

  return (
    <section>
      <BackLink href="/pokemon-card">← cards</BackLink>
      <div className="mt-4">
        <PageIntro title="Owner access">
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-2 mb-6">
            Enter the collection password to add or scan cards. Saving still only writes the local
            JSON in development.
          </p>
        </PageIntro>
      </div>

      <form action={unlockOwner} className="max-w-sm">
        <input type="hidden" name="next" value={next} />
        <label className="flex items-center h-9 rounded-lg border border-neutral-200 dark:border-neutral-800 px-3 text-sm text-neutral-900 dark:text-neutral-100 focus-within:border-orange-600 focus-within:ring-2 focus-within:ring-orange-600">
          <input
            type="password"
            name="password"
            required
            autoFocus
            autoComplete="current-password"
            placeholder="Password"
            className={`${nativeFieldClass} w-full min-w-0 placeholder:text-neutral-400`}
          />
        </label>
        {error ? (
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-3">That password is wrong.</p>
        ) : null}
        <div className="mt-4">
          <PrimaryButton type="submit">Continue</PrimaryButton>
        </div>
      </form>
    </section>
  )
}
