'use server'

import { notFound, redirect } from 'next/navigation'
import { isDevOpen, ownerPassword, passwordsMatch, safeNext, setOwnerCookie } from '../lib/owner'

export async function unlockOwner(formData: FormData) {
  const rawNext = formData.get('next')
  const next = safeNext(typeof rawNext === 'string' ? rawNext : undefined)
  if (isDevOpen()) redirect(next)
  if (!ownerPassword()) notFound()

  const submitted = formData.get('password')
  if (!passwordsMatch(typeof submitted === 'string' ? submitted : '', ownerPassword())) {
    redirect(`/pokemon-card/unlock?next=${encodeURIComponent(next)}&error=1`)
  }

  await setOwnerCookie()
  redirect(next)
}
